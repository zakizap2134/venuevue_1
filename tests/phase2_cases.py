# Runs after all Phase 1 cases in the same disposable database.
print(phpfile('backend/tools/migrate_phase2.php').strip())
print(phpfile('backend/tools/migrate_phase2.php').strip())
passed('phase 2 additive migration is rerunnable')
owner_password='Owner-Recovered-42'
spare=manage('ingredient',name='Editable unit',unit='g',minimum_stock='2',opened_shelf_life_hours=48)['id']
manage('ingredient',id=spare,name='Editable unit',unit='mL',minimum_stock='5.500',opened_shelf_life_hours=72,is_active=0)
assert stock(spare)['unit']=='mL' and int(stock(spare)['is_active'])==0 and int(stock(spare)['opened_shelf_life_hours'])==72
manage('delete_ingredient',id=spare)
assert_status(request('/backend/api.php',{'action':'ingredient','id':milk,'name':'Test Fresh Milk','unit':'g','minimum_stock':'1'},owner),409)
assert_status(request('/backend/api.php',{'action':'delete_ingredient','id':milk},owner),409)
passed('ingredient CRUD and unit protection preserve existing stock history')
p=manage('product',name='Editable product',category='Test')['id']
variant=manage('variant',product_id=p,size='S',temperature='HOT',sku='CRUD-S',price='50')['id']
manage('variant',id=variant,product_id=p,size='L',temperature='ICED',sku='CRUD-L-ICED',price='90',is_active=0)
row=next(x for x in getdata()['variants'] if int(x['id'])==variant)
assert (row['size'],row['temperature'],row['sku'],row['price'],int(row['is_active']))==('L','ICED','CRUD-L-ICED','90.00',0)
manage('recipe',variant_id=variant,rows=[{'ingredient_id':beans,'qty':'1'}])
manage('recipe',variant_id=variant,rows=[])
assert not any(int(r['variant_id'])==variant for r in getdata()['recipes'])
manage('delete_variant',id=variant);manage('delete_product',id=p)
assert_status(request('/backend/api.php',{'action':'delete_variant','id':v},owner),409)
assert_status(request('/backend/api.php',{'action':'product','id':999999,'name':'Missing','category':'Test'},owner),404)
assert_status(request('/backend/api.php',{'action':'product','name':'Test Latte','category':'Test'},owner),409)
passed('variant size/temperature/SKU/price editing, recipe clearing and safe deletion')
b=manage('restock',ingredient_id=milk,container_count=2,quantity_per_container='250',expiration_date=future,reference='Phase 2 delivery',supplier='Supplier A',lot_reference='LOT-2')['id']
batchrow=next(x for x in getdata()['batches'] if int(x['id'])==b)
assert (batchrow['supplier'],batchrow['lot_reference'],batchrow['received_qty'],batchrow['qty_sealed'],batchrow['qty_opened'])==('Supplier A','LOT-2','500.000','500.000','0.000')
manage('batch_update',id=b,reference='Phase 2 corrected',supplier='Supplier B',lot_reference='LOT-2B',expiration_date=future,quarantined=1,reason='Damaged outer packaging')
assert next(x for x in getdata()['batches'] if int(x['id'])==b)['quarantined']==1
c=next(x for x in getdata()['containers'] if int(x['batch_id'])==b)
assert not c['eligible']
before=Decimal(stock(milk)['current_stock']);manage('adjust_out',container_id=c['id'],qty='25',reason='Count correction')
assert Decimal(stock(milk)['current_stock'])==before-25
move=getdata()['movements'][0];assert move['transaction_type']=='ADJUSTMENT' and int(move['user_id'])==1 and move['created_at']
passed('supplier/lot, sealed/opened batch totals, quarantine and actor-attributed adjustments')
dashboard=assert_status(request('/backend/api.php?action=dashboard',token=owner),200)
report=assert_status(request('/backend/api.php?action=sales&from='+today+'&to='+today,token=owner),200)
assert dashboard['totals']==report['totals']
assert_status(request('/backend/api.php?action=dashboard',token=staff),403)
hist=assert_status(request('/backend/api.php?action=history&kind=movements&search=Count&page=1',token=owner),200)
assert hist['total']==1 and hist['rows'][0]['username']=='testowner'
empty=assert_status(request('/backend/api.php?action=history&kind=audit&search=NonexistentEventZ987',token=owner),200)
assert empty['rows']==[] and empty['total']==0
assert_status(request('/backend/api.php?action=sales&from=2026-11-30&to=2026-10-01',token=owner),422)
passed('dashboard equals persisted report totals; history filters and empty states')
backup_secret='Encrypted-Backup-Test-42'
def backup(action,**kwargs):
 return request('/backend/backup.php',{'action':action,'current_password':owner_password,'backup_password':backup_secret,**kwargs},owner)
assert_status(request('/backend/backup.php',{'action':'backup_download'},staff),403)
assert_status(backup('backup_download',current_password='wrong'),403)
envelope=assert_status(backup('backup_download'),200)['envelope']
assert 'tables' not in envelope and 'password_hash' not in json.dumps(envelope)
assert_status(backup('restore_preview',envelope=envelope,backup_password='Wrong-Backup-Password'),422)
corrupt={**envelope,'data':('A' if envelope['data'][0]!='A' else 'B')+envelope['data'][1:]}
assert_status(backup('restore_preview',envelope=corrupt),422)
preview=assert_status(backup('restore_preview',envelope=envelope),200)
assert preview['summary']['counts']['orders']==report['totals']['count']
passed('encrypted backup requires owner password and rejects wrong keys / tampering')
post_backup=manage('product',name='After backup sentinel',category='Test')['id']
before=fullsnapshot()
assert_status(backup('restore_apply',preview_token=preview['preview_token'],confirmation='NO'),422)
assert fullsnapshot()==before
# A failure after table deletion must restore *all* existing rows and sessions.
sql("USE venuevue_phase1_test; CREATE TRIGGER restore_fault BEFORE INSERT ON stock_containers FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected restore failure';")
assert_status(backup('restore_apply',preview_token=preview['preview_token'],confirmation='RESTORE'),422)
assert fullsnapshot()==before
assert any(int(p['product_id'])==post_backup for p in getdata()['products'])
sql('USE venuevue_phase1_test; DROP TRIGGER restore_fault;')
passed('missing confirmation and mid-restore SQL failure preserve data and sessions')
result=assert_status(backup('restore_apply',preview_token=preview['preview_token'],confirmation='RESTORE'),200)
assert result['sign_in_required']
assert_status(request('/backend/api.php?action=management',token=owner),401)
owner=assert_status(request('/backend/auth.php',{'username':'testowner','password':owner_password,'tablet_id':'T-01'}),200)['token']
assert not any(p['product_name']=='After backup sentinel' for p in getdata()['products'])
assert_status(backup('restore_apply',preview_token=preview['preview_token'],confirmation='RESTORE'),409)
safety=assert_status(backup('safety_download',id=result['safety_backup_id']),200)['envelope']
safety_preview=assert_status(backup('restore_preview',envelope=safety),200)
assert safety_preview['summary']['counts']['products']==preview['summary']['counts']['products']+1
restored_report=assert_status(request('/backend/api.php?action=sales&from='+today+'&to='+today,token=owner),200)
assert restored_report['totals']==report['totals']
passed('restore replaces records atomically, preserves owner login, revokes sessions and creates recoverable safety backup')
# Restore did not mutate historical VAT: compare exact line values, not floats.
assert restored_report['sales']==report['sales']
staff=assert_status(request('/backend/auth.php',{'username':'testbarista','password':'Replacement-Test-42','tablet_id':'T-02'}),200)['token']
assert_status(request('/backend/sync.php',example,staff),200)
passed('restored VAT snapshots and existing idempotency keys remain intact')
if os.environ.get('VV_PHASE2_BROWSER')=='1':
 proc=subprocess.run(['node','tests/phase2-browser.mjs',BASE,owner,staff],env=ENV,text=True);assert proc.returncode==0
print('ALL PHASE 2 INTEGRATION CHECKS PASSED',flush=True)
