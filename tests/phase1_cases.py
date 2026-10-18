from decimal import Decimal
# API helpers reuse the disposable database and authenticated sessions in integration.py.
def manage(action,**kwargs):return assert_status(request('/backend/api.php',{'action':action,**kwargs},owner),200)
def getdata():return assert_status(request('/backend/api.php?action=management',token=owner),200)
def stock(i):return next(x for x in getdata()['ingredients'] if int(x['ingredient_id'])==i)
def sale(variant,price='150.00',qty=1,cash='500.00'):
 return {'client_transaction_id':str(uuid.uuid4()),'tablet_id':'T-02','order':{'cash_tendered':cash},'items':[{'variant_id':variant,'quantity':qty,'expected_price':price}]}
def fullsnapshot():
 return sql('USE venuevue_phase1_test; SELECT * FROM stock_batches ORDER BY id; SELECT * FROM stock_containers ORDER BY id; SELECT * FROM orders ORDER BY order_id; SELECT * FROM order_items ORDER BY order_item_id; SELECT * FROM inventory_transactions ORDER BY inventory_transaction_id; SELECT ingredient_id,current_stock FROM ingredients ORDER BY ingredient_id;')
assert_status(request('/backend/api.php?action=management',token=staff),403)
assert_status(request('/backend/api.php',{'action':'product','name':'Forbidden'},staff),403)
passed('Barista cannot read management or mutate inventory')
milk=manage('ingredient',name='Test Fresh Milk',unit='mL',minimum_stock='250',opened_shelf_life_hours=48)['id']
beans=manage('ingredient',name='Test Beans',unit='g',minimum_stock='18',opened_shelf_life_hours=168)['id']
cup=manage('ingredient',name='Test Cup',unit='units',minimum_stock='1')['id']
product=manage('product',name='Test Latte',category='Test')['id']
v=manage('variant',product_id=product,size='M',temperature='HOT',sku='TEST-LATTE-M-HOT',price='150.00')['id']
manage('recipe',variant_id=v,rows=[{'ingredient_id':milk,'qty':'220'},{'ingredient_id':beans,'qty':'18'},{'ingredient_id':cup,'qty':'1'}])
vlarge=manage('variant',product_id=product,size='L',temperature='HOT',sku='TEST-LATTE-L-HOT',price='200.00')['id']
manage('recipe',variant_id=vlarge,rows=[{'ingredient_id':milk,'qty':'2000'},{'ingredient_id':beans,'qty':'36'},{'ingredient_id':cup,'qty':'1'}])
today=sql("SELECT DATE(CONVERT_TZ(NOW(),@@session.time_zone,'+08:00'));").strip()
# Compute fixture dates from PHP's configured DB clock, not the developer workstation.
today=getdata()['server_time'][:10]
import datetime
future=(datetime.date.fromisoformat(today)+datetime.timedelta(days=10)).isoformat();past=(datetime.date.fromisoformat(today)-datetime.timedelta(days=1)).isoformat()

# Existing quantities must be reconciled without increasing aggregate stock.
legacy_before=stock(2)['current_stock']
manage('reconcile',ingredient_id=2,container_count=5,quantity_per_container='1000',expiration_date=future,reference='Verified legacy milk')
assert stock(2)['current_stock']==legacy_before and stock(2)['unallocated_stock']=='0.000'
assert_status(request('/backend/api.php',{'action':'reconcile','ingredient_id':2,'container_count':1,'quantity_per_container':'1000','expiration_date':future,'reference':'Excess'},owner),409)
passed('legacy batch allocation preserves stock total and rejects over-allocation')

batch=manage('restock',ingredient_id=milk,container_count=2,quantity_per_container='500',expiration_date=future,reference='Milk delivery A')['id']
manage('restock',ingredient_id=beans,container_count=1,quantity_per_container='500',expiration_date=future,reference='Beans A')
manage('restock',ingredient_id=cup,container_count=1,quantity_per_container='20',reference='Cups A')
menu=assert_status(request('/backend/api.php?action=catalogue',token=staff),200)
assert next(x for x in menu['variants'] if int(x['id'])==v)['available_count']==4
assert next(x for x in menu['variants'] if int(x['id'])==vlarge)['available_count']==0
passed('explicit variant recipes determine availability independently')
body=sale(v);r=assert_status(request('/backend/sync.php',body,staff),201)
assert (r['total_gross'],r['total_net'],r['total_vat'],r['change_due'])==('150.00','133.93','16.07','350.00'),r
assert stock(milk)['current_stock']=='780.000' and stock(beans)['current_stock']=='482.000'
cs=[c for c in getdata()['containers'] if int(c['batch_id'])==batch]
assert len([c for c in cs if c['opened_at']])==1 and len([c for c in cs if not c['opened_at']])==1
opened=next(c for c in cs if c['opened_at']);assert datetime.datetime.fromisoformat(opened['use_by'])-datetime.datetime.fromisoformat(opened['opened_at'])==datetime.timedelta(hours=48)
passed('milestone: recipe → restock → cash sale → correct stock / VAT / opening clock')
after=fullsnapshot();assert_status(request('/backend/sync.php',body,staff),200);assert fullsnapshot()==after
manage('variant',id=v,product_id=product,size='M',temperature='HOT',sku='TEST-LATTE-M-HOT',price='155.00',is_active=1)
assert_status(request('/backend/sync.php',body,staff),200);assert fullsnapshot()==after
assert_status(request('/backend/sync.php',body,other),409)
assert_status(request('/backend/sync.php',{**body,'order':{'cash_tendered':'600.00'}},staff),409)
assert_status(request('/backend/sync.php',sale(v),staff),409)
assert fullsnapshot()==after
passed('replays return stored VAT after price changes; changed payload / other user / stale price rejected')
manage('variant',id=v,product_id=product,size='M',temperature='HOT',sku='TEST-LATTE-M-HOT',price='150.00',is_active=1)
# Force a failure AFTER header, item and container writes, proving rollback.
sql("USE venuevue_phase1_test; CREATE TRIGGER phase1_fault BEFORE INSERT ON inventory_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test injected ledger failure';")
assert_status(request('/backend/sync.php',sale(v),staff),500);assert fullsnapshot()==after
sql('USE venuevue_phase1_test; DROP TRIGGER phase1_fault;')
passed('injected ledger failure rolls back headers, items, containers, batch totals and stock')
assert_status(request('/backend/sync.php',sale(vlarge,price='200.00'),staff),409);assert fullsnapshot()==after
assert_status(request('/backend/sync.php',sale(v,cash='1.00'),staff),422);assert fullsnapshot()==after
passed('stock and underpayment rejection leave inventory untouched')
# Expiration today eligible; previous day blocked even when quantity is large.
expired=manage('restock',ingredient_id=milk,container_count=1,quantity_per_container='10000',expiration_date=past,reference='Expired delivery')['id']
todaybatch=manage('restock',ingredient_id=milk,container_count=1,quantity_per_container='100',expiration_date=today,reference='Expires today')['id']
# Opened existing milk is consumed ahead of sealed earlier-date milk.
assert_status(request('/backend/sync.php',sale(v),staff),201)
d=getdata();assert next(b for b in d['batches'] if int(b['id'])==todaybatch)['remaining_qty']=='100.000'
assert next(b for b in d['batches'] if int(b['id'])==expired)['remaining_qty']=='10000.000'
# Exhaust opened remainder (60), then today's batch (100), then sealed future (60).
assert_status(request('/backend/sync.php',sale(v),staff),201)
d=getdata();assert next(b for b in d['batches'] if int(b['id'])==todaybatch)['remaining_qty']=='0.000'
assert next(b for b in d['batches'] if int(b['id'])==batch)['remaining_qty']=='440.000'
passed('opened first then FEFO; expiration today usable; expired delivery excluded')
# Opened use-by excluded, not quietly erased or assigned a new opening time.
sql("USE venuevue_phase1_test; UPDATE stock_containers SET use_by='2000-01-01 00:00:00' WHERE batch_id="+str(batch)+" AND remaining_qty>0;")
after=fullsnapshot();assert_status(request('/backend/sync.php',sale(v),staff),409);assert fullsnapshot()==after
assert Decimal(stock(milk)['waste_due'])==Decimal('10440')
c=next(c for c in getdata()['containers'] if int(c['batch_id'])==batch)
manage('waste',container_id=c['id'],qty='440',reason='Opened milk expired');assert stock(milk)['current_stock']=='10000.000'
passed('opened use-by blocked and explicit waste movement records actor / quantity')
# Concurrency: stock sufficient for exactly one order. Two unique keys compete.
manage('restock',ingredient_id=milk,container_count=1,quantity_per_container='220',expiration_date=future,reference='One sale only')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda b:request('/backend/sync.php',b,staff),[sale(v),sale(v)]))
assert sorted(r[0] for r in results)==[201,409],results
assert stock(milk)['eligible_stock']=='0.000'
passed('concurrent distinct sales cannot oversell')
manage('restock',ingredient_id=milk,container_count=1,quantity_per_container='220',expiration_date=future,reference='Duplicate burst')
duplicate=sale(v)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda _:request('/backend/sync.php',duplicate,staff),range(4)))
assert sorted(r[0] for r in results)==[200,200,200,201],results
assert len({r[1]['order_id'] for r in results})==1
passed('concurrent duplicate burst creates one sale and one deduction')
# VAT example, stored history, period report and export reconcile.
p2=manage('product',name='Test Americano',category='Test')['id']
v2=manage('variant',product_id=p2,size='S',temperature='HOT',sku='TEST-AMER-S',price='120')['id']
manage('recipe',variant_id=v2,rows=[{'ingredient_id':beans,'qty':'18'}])
manage('restock',ingredient_id=milk,container_count=1,quantity_per_container='1000',expiration_date=future,reference='VAT test')
example=sale(v,qty=2);example['items'].append({'variant_id':v2,'quantity':1,'expected_price':'120.00'})
r=assert_status(request('/backend/sync.php',example,staff),201)
assert (r['total_gross'],r['total_net'],r['total_vat'])==('420.00','375.00','45.00')
assert [(i['line_net'],i['line_vat']) for i in r['items']]==[('267.86','32.14'),('107.14','12.86')]
rep=assert_status(request('/backend/api.php?action=sales&from='+today+'&to='+today,token=owner),200)
assert Decimal(rep['totals']['gross'])==Decimal(rep['totals']['net'])+Decimal(rep['totals']['vat'])
for s in rep['sales']:
 assert sum(Decimal(i['line_net']) for i in s['items'])==Decimal(s['total_net'])
 assert all(Decimal(i['line_net'])+Decimal(i['line_vat'])==Decimal(i['line_gross']) for i in s['items'])
csv=assert_status(request('/backend/api.php?action=export&from='+today+'&to='+today,token=owner),200)
assert 'TOTAL' in csv and ',gross,net,vat,' in csv
assert_status(request('/backend/api.php?action=sales',token=staff),403)
passed('worked VAT example, sale detail, period report and CSV use persisted snapshots')
rounding=[]
for size in ['S','M','L']:
 tiny=manage('variant',product_id=p2,size=size,temperature='NA',sku='ROUND-'+size,price='0.05')['id']
 manage('recipe',variant_id=tiny,rows=[{'ingredient_id':beans,'qty':'0.001'}])
 rounding.append({'variant_id':tiny,'quantity':1,'expected_price':'0.05'})
basket=sale(v);basket['items']=rounding
rounded=assert_status(request('/backend/sync.php',basket,staff),201)
assert rounded['total_net']=='0.13' and [i['line_net'] for i in rounded['items']]==['0.04','0.04','0.05']
passed('last line absorbs rounding residual without centavo drift')
invalid=sale(v);invalid['items'][0]['quantity']=0
before=fullsnapshot();assert_status(request('/backend/sync.php',invalid,staff),422);assert fullsnapshot()==before
invalid=sale(v);invalid['items'][0]['unit_price']='0.01'
assert_status(request('/backend/sync.php',invalid,staff),422);assert fullsnapshot()==before
passed('zero quantities and client-controlled price fields rejected')
# Staff reset revokes old session; own and other accounts are protected.
manage('staff_reset',user_id=2,password='Replacement-Test-42')
assert_status(request('/backend/api.php?action=catalogue',token=staff),401)
assert_status(request('/backend/api.php',{'action':'staff_reset','user_id':1,'password':'Replacement-Test-42'},owner),403)
staff=assert_status(request('/backend/auth.php',{'username':'testbarista','password':'Replacement-Test-42','tablet_id':'T-02'}),200)['token']
assert_status(request('/backend/sync.php',example,staff),200)
passed('staff reset revokes sessions; same staff can recover pending confirmation after login')
code=manage('recovery_issue',password=password)['recovery_code']
recovery=subprocess.run([PHP,'backend/tools/recover_owner.php'],input='testowner\n'+code+'\nOwner-Recovered-42\n',text=True,capture_output=True,env=ENV);assert recovery.returncode==0,recovery.stderr
assert_status(request('/backend/api.php?action=management',token=owner),401)
again=subprocess.run([PHP,'backend/tools/recover_owner.php'],input='testowner\n'+code+'\nAnother-Password-42\n',text=True,capture_output=True,env=ENV);assert again.returncode!=0
owner=assert_status(request('/backend/auth.php',{'username':'testowner','password':'Owner-Recovered-42','tablet_id':'T-01'}),200)['token']
passed('owner offline code is single-use, rotates, and revokes existing sessions')
bootstrap=subprocess.run([PHP,'backend/tools/create_user.php'],input='testowner\nShould-Not-Work-42\n',text=True,capture_output=True,env=ENV)
assert bootstrap.returncode!=0
passed('provisioning script cannot bypass owner recovery on an existing installation')
# Ledger totals reconcile with batches and aggregate cache for newly created ingredients.
for iid in [milk,beans,cup]:
 totals=sql('USE venuevue_phase1_test; SELECT current_stock,(SELECT SUM(remaining_qty) FROM stock_batches WHERE ingredient_id='+str(iid)+'),(SELECT SUM(quantity_delta) FROM inventory_transactions WHERE ingredient_id='+str(iid)+') FROM ingredients WHERE ingredient_id='+str(iid)+';').strip().split('\t')
 assert len(set(Decimal(x) for x in totals))==1,totals
passed('physical stock = batch remainder = movement ledger after all scenarios')
# Pure allocation boundary test pins a single timestamp across midnight and exact use-by.
unit=subprocess.run([PHP,'tests/time_boundaries.php'],capture_output=True,text=True,env=ENV);assert unit.returncode==0,unit.stdout+unit.stderr;print(unit.stdout.strip())
if os.environ.get('VV_BROWSER_TEST')=='1':
 proc=subprocess.run(['node','tests/browser.mjs',BASE,owner,staff],env=ENV,text=True);assert proc.returncode==0
print('ALL PHASE 1 INTEGRATION CHECKS PASSED',flush=True)
