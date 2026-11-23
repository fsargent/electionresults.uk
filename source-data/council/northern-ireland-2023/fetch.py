import urllib.request,urllib.parse,hashlib,json,concurrent.futures,datetime
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parent
URL='https://www.eoni.org.uk/results-data/local-council-elections-2023-results/'
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links={};self.href=None;self.label='';self.council=None
 def handle_starttag(self,t,a):
  if t=='a': self.href=dict(a).get('href');self.label=''
 def handle_data(self,d):
  if self.href:self.label+=d
  elif d.strip().endswith('Council'):self.council=d.strip()
 def handle_endtag(self,t):
  if t=='a' and self.href:
   u=urllib.parse.urljoin(URL,self.href)
   if '/media/' in u and u.endswith(('.pdf','.xlsx','.xls')) and u not in self.links:
    self.links[u]={'url':u,'label':self.label.strip(),'council':self.council,'filename':u.split('/')[-1]}
   self.href=None
html=urllib.request.urlopen(URL).read();(ROOT/'index.html').write_bytes(html)
p=Links();p.feed(html.decode())
def fetch(item):
 try:
  with urllib.request.urlopen(item['url'],timeout=60) as r:data=r.read();ct=r.headers.get('Content-Type')
  if not(data.startswith(b'%PDF') or data.startswith(b'PK') or data.startswith(bytes.fromhex('d0cf11e0'))):raise ValueError('unexpected format')
  (ROOT/item['filename']).write_bytes(data)
  return dict(item,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),contentType=ct)
 except Exception as e:return dict(item,error=str(e))
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:records=list(pool.map(fetch,p.links.values()))
manifest={'source':URL,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'electionDate':'2023-05-18','files':records}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
copyright_url='https://www.eoni.org.uk/legals/crown-copyright/'
(ROOT/'copyright.html').write_bytes(urllib.request.urlopen(copyright_url).read())
print(json.dumps({'files':len(records),'bytes':sum(r.get('bytes',0) for r in records),'errors':[r for r in records if 'error' in r]}))
