import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
function download(envelope, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(envelope)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function BackupPanel({ request }) {
  const { logout } = useAuth();
  const [password, setPassword] = useState(""),
    [secret, setSecret] = useState(""),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [backups, setBackups] = useState([]),
    [restored, setRestored] = useState(false);
  useEffect(() => {
    request("/backend/api.php?action=safety_backups")
      .then((r) => setBackups(r.backups))
      .catch((e) => setError(e.message));
  }, [request]);
  const action = async (name, extra = {}) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await request("/backend/backup.php", {
        method: "POST",
        json: {
          action: name,
          current_password: password,
          backup_password: secret,
          ...extra,
        },
        signal: AbortSignal.timeout(90000),
      });
      if (name === "backup_download" || name === "safety_download") {
        download(
          r.envelope,
          `VenueVue-${name}-${new Date().toISOString().slice(0, 10)}.json`,
        );
        setMessage(
          "Encrypted backup downloaded. Keep its password separately.",
        );
      }
      if (name === "restore_preview") {
        setPreview(r);
        setMessage("Preview ready. Review the table counts before restoring.");
      }
      if (name === "restore_apply") {
        setRestored(true);
        setPreview(null);
        setPassword("");
        setSecret("");
        setMessage(
          `Restore complete. Safety backup #${r.safety_backup_id} is available after signing in. Your current owner password and recovery code still work.`,
        );
      }
      return r;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const inspect = async () => {
    setPreview(null);
    setError("");
    try {
      if (!file) throw new Error("Choose a VenueVue backup file");
      if (file.size > 34 * 1024 * 1024)
        throw new Error("Backup file is too large");
      const envelope = JSON.parse(await file.text());
      await action("restore_preview", { envelope });
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="vv-card" aria-busy={busy}>
      <h2>Manual backup and restore</h2>
      <p>
        Backups contain sales, stock, catalogue, audit history and accounts.
        Files are encrypted with your backup password. Active login sessions are
        excluded.
      </p>
      {message && (
        <p role="status" className="vv-notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="vv-warning">
          {error}
        </p>
      )}
      {restored ? (
        <button className="vv-primary" onClick={logout}>
          Sign in again
        </button>
      ) : (
        <fieldset disabled={busy}>
          <label className="vv-field">
            Current owner password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="vv-field">
            Backup password (12+ characters)
            <input
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <button
            className="vv-primary"
            disabled={!password || secret.length < 12}
            onClick={() => action("backup_download")}
          >
            Download backup
          </button>
          <hr />
          <h3>Restore from file</h3>
          <p>
            Restore replaces the current business records and staff accounts
            with the selected snapshot. Stop sales on all tablets and reconcile
            pending orders first. The server creates an encrypted safety backup
            before replacement. All users must sign in again afterward.
          </p>
          <label className="vv-field">
            Backup file
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setConfirmation("");
              }}
            />
          </label>
          <button
            disabled={!file || !password || secret.length < 12}
            onClick={inspect}
          >
            Preview restore
          </button>
          {preview && (
            <section className="vv-warning">
              <h3>Snapshot from {preview.summary.created_at}</h3>
              <dl className="vv-totals">
                {Object.entries(preview.summary.counts).map(
                  ([table, count]) => (
                    <div key={table}>
                      <dt>{table.replaceAll("_", " ")}</dt>
                      <dd>{count}</dd>
                    </div>
                  ),
                )}
              </dl>
              <p>
                Preview expires after 10 minutes. Current owner credentials are
                retained. The safety backup uses the backup password entered
                above.
              </p>
              <label className="vv-field">
                Type RESTORE to replace current data
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                className="vv-primary"
                disabled={confirmation !== "RESTORE"}
                onClick={() =>
                  action("restore_apply", {
                    preview_token: preview.preview_token,
                    confirmation,
                  })
                }
              >
                Restore this snapshot
              </button>
            </section>
          )}
          <hr />
          <h3>Pre-restore safety backups</h3>
          {!backups.length ? (
            <p>No restores have been performed.</p>
          ) : (
            backups.map((b) => (
              <p key={b.id}>
                <button
                  disabled={!password}
                  onClick={() => action("safety_download", { id: b.id })}
                >
                  Download #{b.id} · {b.created_at}
                </button>
              </p>
            ))
          )}
        </fieldset>
      )}
      {busy && <p role="status">Processing backup operation…</p>}
    </section>
  );
}
