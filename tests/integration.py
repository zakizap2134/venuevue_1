"""Isolated integration runner. Never points at the production database.
Required: PHP with pdo_mysql, a local MySQL/MariaDB server and mysql CLI.
Set VV_TEST_START_DB=1 plus MYSQLD, MYSQL_BASE, MYSQL_DATA to start a disposable server.
Usage: python tests/integration.py [--baseline | --phase2]
"""
import os,subprocess,time,pathlib,json,urllib.request,urllib.error,uuid,sys,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT)
ENV=os.environ.copy();ENV.update(VENUEVUE_DB_NAME='venuevue_phase1_test',VENUEVUE_DB_PORT=os.environ.get('VV_TEST_DB_PORT','3307'),PHP_CLI_SERVER_WORKERS='4')
PHP=os.environ.get('PHP','php');MYSQL=os.environ.get('MYSQL','mysql');PORT=ENV['VENUEVUE_DB_PORT'];BASE='http://127.0.0.1:18080'
processes=[]
def sql(s):
 return subprocess.check_output([MYSQL,'--no-defaults','--protocol=tcp','-h127.0.0.1','-P'+PORT,'-uroot','-N','-B'],input=s,text=True,env=ENV,stderr=subprocess.PIPE)
def phpfile(f):return subprocess.check_output([PHP,f],env=ENV,text=True)
def request(path,body=None,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(BASE+path,json.dumps(body).encode() if body is not None else None,headers)
 try:
  with urllib.request.urlopen(req,timeout=15) as r:return r.status,json.loads(r.read()) if 'json' in r.headers.get('Content-Type','') else r.read().decode()
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def assert_status(result,status):
 assert result[0]==status,result
 return result[1]
def passed(name):print('PASS '+name,flush=True)
def snapshot():return sql('USE venuevue_phase1_test; SELECT ingredient_id,current_stock FROM ingredients ORDER BY ingredient_id; SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM inventory_transactions;')
try:
 if os.environ.get('VV_TEST_START_DB')=='1':
  db=subprocess.Popen([os.environ['MYSQLD'],'--no-defaults','--user=root','--basedir='+os.environ['MYSQL_BASE'],'--datadir='+os.environ['MYSQL_DATA'],'--socket=','--pid-file='+os.environ['MYSQL_DATA']+'/test.pid','--port='+PORT,'--bind-address=127.0.0.1','--log-error='+os.environ['MYSQL_DATA']+'/test.log'],env=ENV,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);processes.append(db)
 for _ in range(60):
  try:sql('SELECT 1');break
  except subprocess.CalledProcessError:time.sleep(.1)
 else:raise RuntimeError('Test database did not start')
 sql('DROP DATABASE IF EXISTS venuevue_phase1_test; CREATE DATABASE venuevue_phase1_test;')
 for f in ['database/schema.sql','database/migrations/001_catalogue_prerequisites.sql','database/migrations/003_sync_engine_tables.sql','database/seed_demo_data.sql']:
  sql('USE venuevue_phase1_test;\n'+pathlib.Path(f).read_text().replace('`venuevue`','`venuevue_phase1_test`'))
 password='TestOnly-Password-42'
 hashed=subprocess.check_output([PHP,'-r','echo password_hash("TestOnly-Password-42",PASSWORD_DEFAULT);'],text=True)
 if '--baseline' not in sys.argv:
  phpfile('backend/tools/migrate_phase1.php')
  phpfile('backend/tools/migrate_phase2.php')
  bootstrap=subprocess.run([PHP,'backend/tools/create_user.php'],input='testowner\n'+password+'\n',capture_output=True,text=True,env=ENV)
  assert bootstrap.returncode==0,bootstrap.stderr
  assert 'recovery code' in bootstrap.stdout
  sql("USE venuevue_phase1_test; INSERT INTO users(username,password_hash,role) VALUES ('testbarista','"+hashed+"','BARISTA'),('otherbarista','"+hashed+"','BARISTA');")
  passed('fresh owner bootstrap creates account and offline recovery code')
 else:
  sql("USE venuevue_phase1_test; INSERT INTO users(username,password_hash,role) VALUES ('testowner','"+hashed+"','OWNER'),('testbarista','"+hashed+"','BARISTA'),('otherbarista','"+hashed+"','BARISTA');")
 log=open('/tmp/venue-php-test.log','w')
 server_root=ROOT
 if '--baseline' in sys.argv:
  import tempfile,shutil
  baseline_dir=tempfile.TemporaryDirectory(prefix='venuevue-baseline-');server_root=pathlib.Path(baseline_dir.name);(server_root/'backend').mkdir()
  for name in ['config.php','auth.php','auth_middleware.php']:shutil.copy(ROOT/'backend'/name,server_root/'backend'/name)
  (server_root/'backend/auth.php').write_bytes(subprocess.check_output(['git','show','ac70e70:backend/auth.php']))
  (server_root/'backend/sync.php').write_bytes(subprocess.check_output(['git','show','ac70e70:backend/sync.php']))
 command=[PHP,'-S','127.0.0.1:18080','-t',str(server_root)]
 if '--baseline' not in sys.argv:command.append('tests/router.php')
 server=subprocess.Popen(command,env=ENV,stdout=log,stderr=log,start_new_session=True);processes.append(server)
 for _ in range(30):
  try:request('/backend/auth.php');break
  except urllib.error.URLError:time.sleep(.1)
 owner=assert_status(request('/backend/auth.php',{'username':'testowner','password':password,'tablet_id':'T-01'}),200)['token']
 staff=assert_status(request('/backend/auth.php',{'username':'testbarista','password':password,'tablet_id':'T-02'}),200)['token']
 other=assert_status(request('/backend/auth.php',{'username':'otherbarista','password':password,'tablet_id':'T-03'}),200)['token']
 if '--baseline' in sys.argv:
  body={'client_transaction_id':str(uuid.uuid4()),'tablet_id':'T-02','order':{'cash_tendered':500},'items':[{'product_id':12,'quantity':1},{'product_id':5,'quantity':1}]}
  b=assert_status(request('/backend/sync.php',body,staff),201);assert b['total_amount']==290
  after=snapshot();b=assert_status(request('/backend/sync.php',body,staff),200);assert b['duplicate'] and snapshot()==after;passed('original engine confirmation and sequential idempotency')
  bad={**body,'client_transaction_id':str(uuid.uuid4()),'items':[{'product_id':20,'quantity':1}]};assert_status(request('/backend/sync.php',bad,staff),409);assert snapshot()==after;passed('original engine insufficient-stock rollback')
  sql("USE venuevue_phase1_test; CREATE TRIGGER baseline_fault BEFORE INSERT ON inventory_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected test failure';")
  assert_status(request('/backend/sync.php',{**body,'client_transaction_id':str(uuid.uuid4())},staff),500);assert snapshot()==after;passed('original engine database failure rolls back sale and stock')
  sql('USE venuevue_phase1_test; DROP TRIGGER baseline_fault;')
  # Replays after price changes are incorrectly revalidated by the predecessor.
  sql('USE venuevue_phase1_test; UPDATE products SET unit_price=999 WHERE product_id=12;')
  assert_status(request('/backend/sync.php',body,staff),422);passed('reproduced baseline defect: committed replay fails after menu price change')
 else:
  print(phpfile('backend/tools/migrate_phase1.php').strip());print(phpfile('backend/tools/migrate_phase1.php').strip());passed('phase 1 migration resumes safely')
  exec(pathlib.Path('tests/phase1_cases.py').read_text())
  if '--phase2' in sys.argv:exec(pathlib.Path('tests/phase2_cases.py').read_text())
finally:
 import signal
 for p in reversed(processes):
  try:
   if p is locals().get('server'):os.killpg(p.pid,signal.SIGTERM)
   else:p.terminate()
   p.wait(timeout=8)
  except (ProcessLookupError,subprocess.TimeoutExpired):pass
