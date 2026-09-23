<?php

declare(strict_types=1);

/**
 * VenueVue 2.3 - POST /backend/sync.php
 *
 * Order ingestion. This is the authoritative engine behind Mechanism 1 of the
 * project plan (direct online capture) and the endpoint that Mechanisms 2 and 3
 * call once they have normalised their input to the §4.1 contract.
 *
 * Reference: project plan Rev 2.3 §4.1 (wire contract) and §4.2 (production API
 * engine); master audit §3.3.1/§3.3.2. Where those documents and this file
 * differ, the difference is deliberate and called out in a comment.
 *
 * Responsibilities
 *   1. Bearer authentication and API-level RBAC.
 *   2. Payload parsing and strict schema validation.
 *   3. UUIDv4 idempotency, so a lost response cannot create a second order.
 *   4. Authoritative server-side price resolution.
 *   5. Atomic multi-ingredient deduction under SELECT ... FOR UPDATE.
 *   6. Append-only inventory ledger writes.
 *   7. Append-only security audit writes.
 *   8. Low-stock evaluation for the response payload.
 *
 * Request  (application/json, Authorization: Bearer <64-char hex token>):
 *   {
 *     "client_transaction_id": "<UUIDv4>",     // required, the idempotency key
 *     "tablet_id": "T-01",                     // required, <= 16 characters
 *     "event_id": 7,                           // optional
 *     "order": { "cash_tendered": 500.00, "created_at": "2026-11-14 14:30:15" },
 *     "items": [ { "product_id": 12, "quantity": 1 } ]
 *   }
 *
 *   `user_id`, `status`, `payment_method`, `total_amount`, `change_due`,
 *   `order_id`, `duplicate`, `committed_at` and any `unit_price` are FORBIDDEN:
 *   the server owns all of them. Supplying one is a 422, not a silent ignore
 *   (§4.1.6, defect T-03).
 *
 * Responses
 *   201 Created            new order committed
 *     { success:true, order_id, duplicate:false, total_amount, change_due,
 *       low_stock:[...], server_time }
 *   200 OK                 replay of an already committed client_transaction_id;
 *                          NO second deduction is performed
 *     { success:true, order_id, duplicate:true, total_amount, change_due,
 *       message, server_time }
 *   401 Invalid or expired session token
 *   403 Authenticated, but the role may not ingest orders
 *   405 Method other than POST
 *   409 Insufficient ingredient stock; inventory untouched
 *     { success:false, error:"Insufficient stock", ingredient_id, required,
 *       available }
 *   422 Malformed body, or any field that is missing, mis-typed or out of range
 *   500 Unhandled fault; the transaction is rolled back and no internal detail
 *       is ever returned to the client
 *
 * Defects from the predecessor implementation that this file closes:
 *   T-01 envelope mismatch (order is an object, not a scalar) -> section 4
 *   T-03 client-supplied user_id/status/payment_method          -> section 3
 *   T-05 dead concurrency guard (execute() used as a row count) -> section 8
 *   T-18 unselected recipe column read                          -> section 7
 *   CR-01/CR-02 no authentication, no RBAC                      -> section 2
 *   CR-10 negative quantities inflating stock                   -> section 4
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_middleware.php';

/* =============================================================================
 * Contract limits
 * ========================================================================== */

/** Sanity ceiling for one line of a pop-up coffee order (§4.2). */
const VENUEVUE_SYNC_MAX_QTY_PER_LINE = 100;

/**
 * Ceiling on the number of distinct lines in one order. Not specified by §4.1,
 * which only bounds quantity; added as defence in depth because an unbounded
 * array is an unbounded amount of work inside a write transaction.
 */
const VENUEVUE_SYNC_MAX_ITEM_LINES = 100;

/** orders.tablet_id is VARCHAR(16); §4.1 caps the field at 16 characters. */
const VENUEVUE_SYNC_TABLET_ID_MAX_LENGTH = 16;

const VENUEVUE_SYNC_UUID_V4_PATTERN =
    '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';

/** Tablet identifiers are printed on the hardware: T-01, T-02, ... */
const VENUEVUE_SYNC_TABLET_ID_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9._-]{0,15}$/';

/**
 * Shapes accepted for order.created_at: the worked example's
 * "2026-11-14 14:30:15" and ISO-8601, with or without an offset.
 */
const VENUEVUE_SYNC_DATETIME_PATTERN =
    '/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})?$/i';

/**
 * Roles permitted to ingest an order. Both roles sell: the owner covers shifts.
 * Kept as a single source of truth so a future operation with a narrower role
 * list can be gated the same way.
 */
const VENUEVUE_SYNC_ALLOWED_ROLES = VENUEVUE_ALLOWED_ROLES;

/**
 * Fields the server owns outright (§4.1.6). `property_exists` is used against
 * these, never `??`, so that an explicit null is still treated as the client
 * asserting the field rather than as an absent one.
 */
const VENUEVUE_SYNC_FORBIDDEN_TOP_LEVEL = [
    'user_id',
    'status',
    'payment_method',
    'total_amount',
    'change_due',
    'order_id',
    'duplicate',
    'committed_at',
    'unit_price',
];

const VENUEVUE_SYNC_FORBIDDEN_ITEM_KEYS = [
    'unit_price',
    'line_total',
    'order_id',
    'product_name',
];

/* =============================================================================
 * Entry point
 *
 * bootstrap_api() sends the CORS headers (origin allow-list, never a wildcard),
 * answers a preflight itself with 204, and installs an exception handler that
 * turns any uncaught throwable into a bare JSON 500 - so no database or SQL
 * internal can reach the client even if something escapes the handler below.
 * ========================================================================== */

bootstrap_api();
require_post();          // 405 with `Allow: POST` for anything else

/* =============================================================================
 * Helpers
 * ========================================================================== */

/**
 * Decode the request body as a JSON object.
 *
 * Objects are decoded to stdClass instead of to associative arrays on purpose.
 * With `assoc: true` an empty JSON object `{}` and an empty JSON array `[]` both
 * collapse to PHP's `[]`, so the two cannot be told apart afterwards - which is
 * the same class of envelope mistake defect T-01 describes. Decoding to native
 * JSON types keeps the type of every field observable, so "order must be an
 * object" can actually be enforced.
 *
 * Deliberately not read_json_body() from config.php: that helper answers 400 for
 * an absent or malformed body, while the §4.1 contract classifies a bad payload
 * as 422. Keeping 400 out of this endpoint means a client only has to handle the
 * documented codes.
 */
function sync_json_body(): stdClass
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        fail(422, 'Request body must be a JSON object.');
    }

    // Objects become stdClass, arrays stay arrays, and an invalid document
    // becomes null - so this single check rejects both malformed JSON and a
    // well-formed JSON array or scalar at the root.
    $decoded = json_decode($raw, false);

    if (!$decoded instanceof stdClass) {
        fail(422, 'Malformed JSON: the request body must be a JSON object.');
    }

    return $decoded;
}

/**
 * A strictly positive integer, or NULL when the value is anything else.
 *
 * Floats are rejected rather than truncated: `2.5` must not silently become
 * quantity 2, and `-1` must never become a stock *increase* (CR-10).
 */
function sync_positive_int(mixed $value): ?int
{
    if (is_int($value)) {
        return $value > 0 ? $value : null;
    }

    if (is_string($value) && preg_match('/^\d+$/', $value) === 1) {
        $parsed = (int) $value;

        return $parsed > 0 ? $parsed : null;
    }

    return null;
}

/**
 * The JSON type name of a decoded value, for precise 422 messages.
 */
function sync_json_type(mixed $value): string
{
    return match (true) {
        $value instanceof stdClass => 'object',
        is_array($value) => 'array',
        is_string($value) => 'string',
        is_bool($value) => 'boolean',
        $value === null => 'null',
        default => 'number',
    };
}

/**
 * Parse the request body.
 *
 * Returns the validated scalar fields plus the normalised line items. Every
 * rejection here is a 422, and nothing has been written yet.
 *
 * @param stdClass $payload Decoded request body, as JSON-native types.
 * @return array{txn_id: string, tablet_id: string, event_id: int|null,
 *               cash_tendered: float|null, client_created_at: string|null,
 *               items: array<int, array{product_id: int, quantity: int}>}
 */
function sync_parse_request(stdClass $payload): array
{
    // ---- Fields the server owns must be absent -----------------------------
    foreach (VENUEVUE_SYNC_FORBIDDEN_TOP_LEVEL as $key) {
        // property_exists, not isset: an explicit `"user_id": null` is still a
        // client asserting a field it does not own (T-03).
        if (property_exists($payload, $key)) {
            fail(422, $key . ' must not be supplied by the client; the server derives it.');
        }
    }

    // ---- Idempotency key ---------------------------------------------------
    $txnId = $payload->client_transaction_id ?? null;

    if (!is_string($txnId) || preg_match(VENUEVUE_SYNC_UUID_V4_PATTERN, $txnId) !== 1) {
        fail(422, 'client_transaction_id must be a UUIDv4.');
    }

    // orders.client_transaction_id is CHAR(36) under a case-insensitive
    // collation, so 'ABC...' and 'abc...' are the same row. Normalising here
    // keeps the duplicate pre-check and the UNIQUE key in agreement.
    $txnId = strtolower($txnId);

    // ---- Tablet ------------------------------------------------------------
    $tabletId = $payload->tablet_id ?? null;

    if (!is_string($tabletId)) {
        fail(422, 'tablet_id must be a string.');
    }

    $tabletId = trim($tabletId);

    if ($tabletId === '') {
        fail(422, 'tablet_id is required.');
    }

    if (strlen($tabletId) > VENUEVUE_SYNC_TABLET_ID_MAX_LENGTH) {
        fail(422, 'tablet_id must be ' . VENUEVUE_SYNC_TABLET_ID_MAX_LENGTH . ' characters or fewer.');
    }

    if (preg_match(VENUEVUE_SYNC_TABLET_ID_PATTERN, $tabletId) !== 1) {
        fail(422, 'tablet_id must start alphanumeric and contain only letters, digits, dot, dash or underscore.');
    }

    // ---- Optional event ----------------------------------------------------
    $eventId = null;

    if (($payload->event_id ?? null) !== null) {
        $eventId = sync_positive_int($payload->event_id);

        if ($eventId === null) {
            fail(422, 'event_id must be a positive integer.');
        }
    }

    // ---- order object ------------------------------------------------------
    // An absent or null `order` is equivalent to an empty object: both of its
    // documented members are optional. Anything else must genuinely be a JSON
    // object - `"order": []` is an array, and is refused as such.
    $order = $payload->order ?? null;

    if ($order === null) {
        $order = new stdClass();
    }

    if (!$order instanceof stdClass) {
        fail(422, 'order must be a JSON object, not a ' . sync_json_type($order) . '.');
    }

    $cashTendered = null;

    if (($order->cash_tendered ?? null) !== null) {
        $rawCash = $order->cash_tendered;

        if (!is_int($rawCash) && !is_float($rawCash)
            && !(is_string($rawCash) && is_numeric($rawCash))) {
            fail(422, 'order.cash_tendered must be a number.');
        }

        $cashTendered = round((float) $rawCash, 2);

        if ($cashTendered <= 0.0) {
            fail(422, 'order.cash_tendered must be greater than zero.');
        }
    }

    // Accepted and validated, but deliberately NOT used as the stored timestamp:
    // see the note on `created_at` in the insert below. A tablet with a wrong
    // clock must not be able to back-date or future-date revenue.
    $clientCreatedAt = null;

    if (($order->created_at ?? null) !== null) {
        if (!is_string($order->created_at)
            || preg_match(VENUEVUE_SYNC_DATETIME_PATTERN, $order->created_at) !== 1) {
            fail(422, 'order.created_at must be "YYYY-MM-DD HH:MM:SS" or ISO-8601.');
        }

        $clientCreatedAt = $order->created_at;
    }

    // ---- Line items --------------------------------------------------------
    $items = $payload->items ?? null;

    // A decoded JSON array is always a PHP list, so only the type, the emptiness
    // and the ceiling need checking here.
    if (!is_array($items) || $items === []) {
        fail(422, 'items must be a JSON array containing at least one line.');
    }

    if (count($items) > VENUEVUE_SYNC_MAX_ITEM_LINES) {
        fail(422, 'items must contain ' . VENUEVUE_SYNC_MAX_ITEM_LINES . ' lines or fewer.');
    }

    $lines = [];

    foreach ($items as $index => $line) {
        if (!$line instanceof stdClass) {
            fail(422, 'items[' . $index . '] must be a JSON object, not a '
                . sync_json_type($line) . '.');
        }

        // A price snapshot from the till would let a tablet set its own
        // revenue; FR-03 requires the server to resolve it (§4.1.6).
        foreach (VENUEVUE_SYNC_FORBIDDEN_ITEM_KEYS as $key) {
            if (property_exists($line, $key)) {
                fail(422, 'items[' . $index . '].' . $key
                    . ' must not be supplied by the client; the server resolves prices.');
            }
        }

        $productId = sync_positive_int($line->product_id ?? null);

        if ($productId === null) {
            fail(422, 'items[' . $index . '].product_id must be a positive integer.');
        }

        $quantity = sync_positive_int($line->quantity ?? null);

        // Zero and negative quantities are refused outright. The predecessor
        // implementation accepted them and *increased* stock (CR-10).
        if ($quantity === null) {
            fail(422, 'items[' . $index . '].quantity must be a positive integer.');
        }

        if ($quantity > VENUEVUE_SYNC_MAX_QTY_PER_LINE) {
            fail(422, 'items[' . $index . '].quantity must be '
                . VENUEVUE_SYNC_MAX_QTY_PER_LINE . ' or fewer.');
        }

        $lines[] = ['product_id' => $productId, 'quantity' => $quantity];
    }

    return [
        'txn_id' => $txnId,
        'tablet_id' => $tabletId,
        'event_id' => $eventId,
        'cash_tendered' => $cashTendered,
        'client_created_at' => $clientCreatedAt,
        'items' => $lines,
    ];
}

/**
 * Resolve each line against the menu and return the priced basket.
 *
 * Prices come from products.unit_price and nowhere else. Totals are accumulated
 * in integer centavos so that no floating-point drift can make the recorded
 * total disagree with the sum of the line items.
 *
 * @param array<int, array{product_id: int, quantity: int}> $lines
 * @return array{lines: array<int, array<string, mixed>>, total_cents: int}
 */
function sync_resolve_prices(PDO $pdo, array $lines): array
{
    $statement = $pdo->prepare(
        'SELECT product_id, product_name, unit_price
           FROM products
          WHERE product_id = :product_id AND is_active = 1
          LIMIT 1'
    );

    $resolved = [];
    $totalCents = 0;

    foreach ($lines as $line) {
        $statement->execute([':product_id' => $line['product_id']]);
        $product = $statement->fetch();

        if (!is_array($product)) {
            fail(422, 'items[].product_id ' . $line['product_id']
                . ' does not exist or is not on the active menu.');
        }

        $unitCents = (int) round((float) $product['unit_price'] * 100);
        $totalCents += $unitCents * $line['quantity'];

        $resolved[] = [
            'product_id' => (int) $product['product_id'],
            'product_name' => (string) $product['product_name'],
            'quantity' => $line['quantity'],
            'unit_price_cents' => $unitCents,
        ];
    }

    return ['lines' => $resolved, 'total_cents' => $totalCents];
}

/**
 * Aggregate the recipe requirements of the whole basket per ingredient.
 *
 * Aggregation is what makes the worked example correct: two drinks that both use
 * espresso produce ONE lock, ONE decrement and ONE ledger row for the combined
 * 36 g, not two competing updates.
 *
 * @param array<int, array<string, mixed>> $resolvedLines
 * @return array<int, float> ingredient_id => quantity required
 */
function sync_aggregate_requirements(PDO $pdo, array $resolvedLines): array
{
    $statement = $pdo->prepare(
        'SELECT ingredient_id, quantity_required
           FROM recipe_items
          WHERE product_id = :product_id'
    );

    $need = [];

    foreach ($resolvedLines as $line) {
        $statement->execute([':product_id' => $line['product_id']]);

        foreach ($statement->fetchAll() as $recipe) {
            // Both columns are named explicitly. The predecessor read a column
            // it had never selected (T-18), which is what quietly zeroed its
            // deduction math.
            $ingredientId = (int) $recipe['ingredient_id'];
            $required = (float) $recipe['quantity_required'] * (int) $line['quantity'];

            $need[$ingredientId] = round(($need[$ingredientId] ?? 0.0) + $required, 3);
        }
    }

    // A product with no recipe rows (a resale bottle of water, say) simply
    // contributes nothing. That is legitimate and must not fail the order.
    ksort($need);   // ascending ingredient_id: a consistent lock order

    return $need;
}

/**
 * Look up an already committed order by its idempotency key.
 *
 * @return array<string, mixed>|null
 */
function sync_find_existing_order(PDO $pdo, string $txnId): ?array
{
    $statement = $pdo->prepare(
        'SELECT order_id, total_amount, cash_tendered, change_due
           FROM orders
          WHERE client_transaction_id = :txn_id
          LIMIT 1'
    );

    $statement->execute([':txn_id' => $txnId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

/**
 * Roll the transaction back and fail. Every rejection raised while the
 * transaction is open goes through here, so the response can promise that
 * inventory and orders are untouched.
 */
function sync_abort(PDO $pdo, int $status, string $message, array $extra = []): never
{
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    fail($status, $message, $extra);
}

/**
 * Order lines as JSON, with numeric columns cast to numbers.
 *
 * PDO returns DECIMAL columns as strings ("120.000"); a JavaScript client would
 * then do string concatenation instead of arithmetic.
 *
 * @param array<int, array<string, mixed>> $rows
 * @return array<int, array<string, mixed>>
 */
function sync_low_stock_payload(array $rows): array
{
    return array_map(static fn (array $row): array => [
        'ingredient_id' => (int) $row['ingredient_id'],
        'ingredient_name' => (string) $row['ingredient_name'],
        'unit' => (string) $row['unit'],
        'current_stock' => (float) $row['current_stock'],
        'minimum_stock' => (float) $row['minimum_stock'],
    ], $rows);
}

/**
 * The current database time as ISO-8601.
 *
 * Read from MySQL rather than from PHP on purpose. This stack runs PHP in
 * Europe/Berlin and MySQL in the machine's local zone (+08:00 here), so
 * date('c') would report a server_time seven hours away from the committed_at
 * value in the very same transaction. auth.php takes the same view - it lets
 * MySQL compute api_sessions.expires_at - so every timestamp the API publishes
 * stays in one frame, the database's.
 */
function sync_server_time(PDO $pdo): string
{
    $row = $pdo->query(
        "SELECT DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s') AS stamp,
                TIMEDIFF(NOW(), UTC_TIMESTAMP())         AS utc_offset"
    )->fetch();

    $stamp = is_array($row) ? (string) ($row['stamp'] ?? '') : '';
    $offset = is_array($row) ? (string) ($row['utc_offset'] ?? '') : '';

    // TIMEDIFF yields '08:00:00' or '-05:30:00'; render it as '+08:00'.
    if (preg_match('/^(-)?(\d{1,3}):(\d{2}):\d{2}$/', $offset, $matches) === 1) {
        return $stamp . ($matches[1] === '-' ? '-' : '+')
            . str_pad($matches[2], 2, '0', STR_PAD_LEFT) . ':' . $matches[3];
    }

    return $stamp;
}

/* =============================================================================
 * 1. Authentication and authorization
 * ========================================================================== */

$pdo = get_pdo();

// Terminates with 401 (and an audit row) unless the bearer token resolves to a
// live session belonging to an active user.
$session = authenticate_request($pdo);

// Terminates with 403 plus an RBAC_DENIED audit row if the role is not
// permitted. Both BARISTA and OWNER sell, so in normal operation this passes;
// it is here so the endpoint's authority is explicit rather than implied.
require_role($pdo, $session, VENUEVUE_SYNC_ALLOWED_ROLES);

$userId = (int) $session['user_id'];

/* =============================================================================
 * 2. Input
 * ========================================================================== */

$request = sync_parse_request(sync_json_body());

// Prices are resolved before the write transaction opens, which keeps the lock
// window - and therefore L_trans - as short as the deduction itself.
$priced = sync_resolve_prices($pdo, $request['items']);
$totalCents = $priced['total_cents'];

if ($request['cash_tendered'] !== null
    && (int) round($request['cash_tendered'] * 100) < $totalCents) {
    fail(422, 'order.cash_tendered is less than the order total of '
        . number_format($totalCents / 100, 2, '.', '') . '.');
}

// An unknown event would otherwise surface as a foreign-key violation and a 500.
if ($request['event_id'] !== null) {
    $eventStatement = $pdo->prepare('SELECT event_id FROM events WHERE event_id = :event_id LIMIT 1');
    $eventStatement->execute([':event_id' => $request['event_id']]);

    if ($eventStatement->fetch() === false) {
        fail(422, 'event_id ' . $request['event_id'] . ' does not exist.');
    }
}

/* =============================================================================
 * 3. Commit
 * ========================================================================== */

try {
    $pdo->beginTransaction();

    // ---- 3a. Idempotency, before anything is written -----------------------
    if (($existing = sync_find_existing_order($pdo, $request['txn_id'])) !== null) {
        $pdo->commit();

        // A replay is a success, and specifically NOT a second deduction. The
        // client promotes its queued record to COMMITTED on this response.
        audit_log($pdo, $userId, 'ORDER_DUPLICATE', 'ORDER', (int) $existing['order_id'], [
            'client_transaction_id' => $request['txn_id'],
            'tablet_id' => $request['tablet_id'],
            'role' => $session['role'],
            'session_id' => $session['session_id'],
        ]);

        json_response(200, [
            'success' => true,
            'order_id' => (int) $existing['order_id'],
            'duplicate' => true,
            'total_amount' => (float) $existing['total_amount'],
            'change_due' => $existing['change_due'] !== null ? (float) $existing['change_due'] : null,
            'message' => 'Already committed; no re-deduction performed.',
            'server_time' => sync_server_time($pdo),
        ]);
    }

    // ---- 3b. Aggregate requirements and lock the affected rows -------------
    $need = sync_aggregate_requirements($pdo, $priced['lines']);
    $stock = [];

    if ($need !== []) {
        $ids = array_keys($need);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        // FOR UPDATE is the whole concurrency story: a second tablet selling the
        // same ingredient blocks here until this transaction commits, then reads
        // post-commit values. No lost update is possible. ORDER BY ascending
        // ingredient_id gives concurrent transactions the same lock order, which
        // is what keeps two multi-ingredient orders from deadlocking.
        $lockStatement = $pdo->prepare(
            'SELECT ingredient_id, current_stock
               FROM ingredients
              WHERE ingredient_id IN (' . $placeholders . ')
              ORDER BY ingredient_id
              FOR UPDATE'
        );

        $lockStatement->execute($ids);

        foreach ($lockStatement->fetchAll() as $row) {
            $stock[(int) $row['ingredient_id']] = (float) $row['current_stock'];
        }

        foreach ($need as $ingredientId => $required) {
            $available = $stock[$ingredientId] ?? 0.0;

            // A business rule violation, not a server fault: HTTP 409, with the
            // numbers the tablet needs to explain itself to the barista.
            if (round($available, 3) < round($required, 3)) {
                sync_abort($pdo, 409, 'Insufficient stock', [
                    'ingredient_id' => $ingredientId,
                    'required' => $required,
                    'available' => $available,
                ]);
            }
        }
    }

    // ---- 3c. Order header -------------------------------------------------
    $cashTendered = $request['cash_tendered'];
    $changeDue = $cashTendered !== null
        ? round(($cashTendered - $totalCents / 100), 2)
        : null;

    // `created_at` is deliberately not taken from order.created_at: a tablet
    // with a wrong clock would otherwise be able to date revenue whenever it
    // liked. The server's clock governs the ledger; the client's claim is
    // preserved in the audit row instead. committed_at is the server's commit
    // time, per §3.2.
    $insertOrder = $pdo->prepare(
        'INSERT INTO orders
                (client_transaction_id, user_id, tablet_id, event_id,
                 payment_method, total_amount, cash_tendered, change_due, committed_at)
         VALUES (:txn_id, :user_id, :tablet_id, :event_id,
                 "cash", :total_amount, :cash_tendered, :change_due, NOW())'
    );

    $insertOrder->execute([
        ':txn_id' => $request['txn_id'],
        ':user_id' => $userId,          // from the session, never the payload
        ':tablet_id' => $request['tablet_id'],
        ':event_id' => $request['event_id'],
        ':total_amount' => $totalCents / 100,
        ':cash_tendered' => $cashTendered,
        ':change_due' => $changeDue,
    ]);

    $orderId = (int) $pdo->lastInsertId();

    // ---- 3d. Line items, with the price snapshot --------------------------
    $insertItem = $pdo->prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES (:order_id, :product_id, :quantity, :unit_price)'
    );

    foreach ($priced['lines'] as $line) {
        $insertItem->execute([
            ':order_id' => $orderId,
            ':product_id' => $line['product_id'],
            ':quantity' => $line['quantity'],
            ':unit_price' => $line['unit_price_cents'] / 100,
        ]);
    }

    // ---- 3e. Deduct, and write the append-only ledger ---------------------
    $deduct = $pdo->prepare(
        'UPDATE ingredients
            SET current_stock = current_stock - :amount
          WHERE ingredient_id = :ingredient_id
            AND current_stock >= :minimum'
    );

    $ledger = $pdo->prepare(
        'INSERT INTO inventory_transactions
                (ingredient_id, user_id, order_id, transaction_type, quantity_delta, reason)
         VALUES (:ingredient_id, :user_id, :order_id, "SALE", :quantity_delta, :reason)'
    );

    foreach ($need as $ingredientId => $required) {
        $deduct->execute([
            ':amount' => $required,
            ':ingredient_id' => $ingredientId,
            ':minimum' => $required,
        ]);

        // rowCount() is the real concurrency guard. The predecessor compared the
        // boolean result of execute() to zero, so the check never fired (T-05).
        // Reaching this line with a zero count would mean a locked row changed
        // underneath us, which is an invariant break, not a business rule.
        if ($deduct->rowCount() !== 1) {
            throw new RuntimeException(
                'concurrency guard: ingredient ' . $ingredientId . ' was not decremented'
            );
        }

        $ledger->execute([
            ':ingredient_id' => $ingredientId,
            ':user_id' => $userId,
            ':order_id' => $orderId,
            ':quantity_delta' => -$required,     // negative for a SALE
            ':reason' => 'Order #' . $orderId,
        ]);
    }

    // ---- 3f. Audit trail --------------------------------------------------
    $auditDetails = [
        'client_transaction_id' => $request['txn_id'],
        'tablet_id' => $request['tablet_id'],
        'session_tablet_id' => $session['tablet_id'],
        'event_id' => $request['event_id'],
        'total_amount' => $totalCents / 100,
        'cash_tendered' => $cashTendered,
        'line_count' => count($priced['lines']),
        'ingredients_deducted' => count($need),
        'role' => $session['role'],
        'username' => $session['username'],
        'session_id' => $session['session_id'],
        'user_agent' => client_user_agent(),
    ];

    // The token was issued to one device; an order claiming another is worth
    // recording even though it is not refused (a tablet may legitimately be
    // relabelled without a fresh sign-in).
    if ($session['tablet_id'] !== $request['tablet_id']) {
        $auditDetails['tablet_id_mismatch'] = true;
    }

    if ($request['client_created_at'] !== null) {
        $auditDetails['client_claimed_created_at'] = $request['client_created_at'];
    }

    audit_log($pdo, $userId, 'ORDER_COMMIT', 'ORDER', $orderId, $auditDetails);

    $pdo->commit();
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // Two tablets can both pass the 3a pre-check for the same key and race to
    // the INSERT; the UNIQUE constraint then lets exactly one through. The
    // loser is a duplicate burst, not a server error, so it gets the same 200
    // the pre-check would have returned - but only once the row is really there.
    if (($existing = sync_find_existing_order($pdo, $request['txn_id'])) !== null) {
        audit_log($pdo, $userId, 'ORDER_DUPLICATE', 'ORDER', (int) $existing['order_id'], [
            'client_transaction_id' => $request['txn_id'],
            'tablet_id' => $request['tablet_id'],
            'resolved_by' => 'unique_constraint_race',
        ]);

        json_response(200, [
            'success' => true,
            'order_id' => (int) $existing['order_id'],
            'duplicate' => true,
            'total_amount' => (float) $existing['total_amount'],
            'change_due' => $existing['change_due'] !== null ? (float) $existing['change_due'] : null,
            'message' => 'Already committed; no re-deduction performed.',
            'server_time' => sync_server_time($pdo),
        ]);
    }

    // Logged in full, returned not at all.
    error_log('[venuevue] sync.php order ' . $request['txn_id'] . ' failed: ' . $exception->getMessage());
    fail(500, 'Transaction failed; database state unchanged');
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[venuevue] sync.php order ' . $request['txn_id'] . ' aborted: ' . $exception->getMessage());
    fail(500, 'Transaction failed; database state unchanged');
}

/* =============================================================================
 * 4. Response
 * ========================================================================== */

// Read after the commit, so the badges reflect the stock the customer just
// consumed rather than the pre-sale state.
$lowStock = $pdo->query(
    'SELECT ingredient_id, ingredient_name, unit, current_stock, minimum_stock
       FROM ingredients
      WHERE is_active = 1 AND current_stock <= minimum_stock
      ORDER BY ingredient_name'
)->fetchAll();

json_response(201, [
    'success' => true,
    'order_id' => $orderId,
    'duplicate' => false,
    'total_amount' => $totalCents / 100,
    'change_due' => $changeDue,
    'low_stock' => sync_low_stock_payload($lowStock),
    'server_time' => sync_server_time($pdo),
]);
