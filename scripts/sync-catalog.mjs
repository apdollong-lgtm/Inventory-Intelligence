import fs from 'node:fs';
import path from 'node:path';
const base = process.env.CATALOG_API_URL || 'https://catalog.factorystudio.pro';
const metadata = JSON.parse(fs.readFileSync('catalog-product.json','utf8'));
const requestUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
requestUrl.searchParams.set('audience', 'https://catalog.factorystudio.pro');
const oidc = await fetch(requestUrl,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`}});
if (!oidc.ok) throw new Error('GitHub OIDC request failed: ' + oidc.status);
const {value:token} = await oidc.json();
const headers = {Authorization:`Bearer ${token}`,'X-Product-Slug':metadata.slug};
async function checked(url, options) {
  const response = await fetch(url,options);
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}): ${(await response.text()).slice(0,400)}`);
  return response;
}
await checked(`${base}/api/integrations/github-release`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(metadata)});
async function upload(file,type,label,contentType) {
  const bytes = fs.readFileSync(file);
  const h={...headers,'Content-Type':contentType,'X-Release-Version':metadata.version,'X-Asset-Type':type,'X-Asset-Label':label,'X-File-Name':path.basename(file),'X-File-Size':String(bytes.length)};
  const prep=await checked(`${base}/api/integrations/github-release`,{method:'POST',headers:h});
  const {upload}=await prep.json();
  await checked(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':contentType},body:bytes});
  await checked(`${base}/api/integrations/github-release`,{method:'PATCH',headers:{...h,'X-Upload-Id':upload.id,'X-Upload-Key':upload.key}});
  console.log(`Synced ${type}: ${path.basename(file)}`);
}
await upload('dist/inventory-intelligence.zip','package','Source and installation guide','application/zip');
if (fs.existsSync('out/installation-guide.mp4')) await upload('out/installation-guide.mp4','video','Thai installation guide','video/mp4');
console.log('Catalog sync complete: '+base+'/catalog/'+metadata.slug);
