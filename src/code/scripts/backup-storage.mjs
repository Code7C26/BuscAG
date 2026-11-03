// Operator-only Storage export: read APIs only. Never deletes/uploads/updates.
import {mkdir,writeFile,readFile,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const repository=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const hash=value=>createHash('sha256').update(value).digest('hex');
const localName=(bucket,name)=>'objects/'+hash(bucket+'\0'+name)+'.bin';
export function backupConfiguration(url,key) {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(parsed.hostname)||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||(parsed.port&&parsed.port!=='443'))throw Error('Use the official project HTTPS origin');
  let serverKey=typeof key==='string'&&key.startsWith('sb_secret_')&&key.length>=32;
  if(!serverKey&&typeof key==='string')try{serverKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='service_role';}catch{}
  if(!serverKey)throw Error('A server-only key is required');
  return parsed.origin;
}
export async function exportStorage(client,target,buckets,options={}) {
  if(!buckets.length||new Set(buckets).size!==buckets.length)throw Error('Explicit unique buckets required');
  const parent=await realpath(path.dirname(path.resolve(target)));
  target=path.join(parent,path.basename(path.resolve(target)));
  const relative=path.relative(repository,target);
  if(!relative||(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)))throw Error('Backup must be outside the repository');
  // Reject an existing destination; never overwrite even a previous backup.
  await mkdir(target,{mode:0o700});await mkdir(path.join(target,'objects'),{mode:0o700});
  const manifest={version:1,state:'complete',coverage:'selected-buckets',snapshot_consistent:false,source_origin:options.origin??null,buckets:[],objects:[]};
  const visited=new Set(),seen=new Set();
  for(const bucket of buckets) {
    const {data:info,error:bucketError}=await client.storage.getBucket(bucket);
    if(bucketError||!info)throw Error('Bucket metadata unavailable');
    manifest.buckets.push({id:bucket,public:info.public,file_size_limit:info.file_size_limit,allowed_mime_types:info.allowed_mime_types});
    const api=client.storage.from(bucket);
    const walk=async(prefix,depth=0)=>{
      const key=bucket+'\0'+prefix;
      if(depth>64||visited.has(key))throw Error('Invalid directory traversal');visited.add(key);
      for(let offset=0;;){
        const {data,error}=await api.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
        if(error||!Array.isArray(data))throw Error('Storage inventory failed');if(!data.length)break;
        offset+=data.length;
        for(const object of data){
          if(typeof object.name!=='string'||!object.name)throw Error('Invalid object name');
          const name=prefix?prefix+'/'+object.name:object.name;
          if(object.id===null){await walk(name,depth+1);continue;}
          const identity=bucket+'\0'+name;
          if(seen.has(identity))throw Error('Duplicate inventory; freeze writes and retry');seen.add(identity);
          const size=Number(object.metadata?.size);
          if(!Number.isSafeInteger(size)||size<0||size>50*1024*1024)throw Error('Unsupported object size; use an alternate export tool');
          const {data:blob,error:downloadError}=await api.download(name);
          if(downloadError||!blob||blob.size!==size)throw Error('Object changed or download failed');
          const bytes=Buffer.from(await blob.arrayBuffer());const file=localName(bucket,name);
          await writeFile(path.join(target,file),bytes,{mode:0o600,flag:'wx'});
          manifest.objects.push({bucket,name,file,size,sha256:hash(bytes),content_type:object.metadata?.mimetype??blob.type,cache_control:object.metadata?.cacheControl??null});
        }
      }
    };
    await walk('');
  }
  // A failed/partial export deliberately has no complete manifest.
  await writeFile(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  return {buckets:manifest.buckets.length,objects:manifest.objects.length,bytes:manifest.objects.reduce((sum,row)=>sum+row.size,0),snapshot_consistent:false};
}
export async function verifyStorage(target) {
  const manifest=JSON.parse(await readFile(path.join(target,'manifest.json'),'utf8'));
  if(manifest.version!==1||manifest.state!=='complete'||!Array.isArray(manifest.objects)||!Array.isArray(manifest.buckets))throw Error('Incomplete manifest');
  const files=new Set();let total=0;
  for(const row of manifest.objects){
    if(typeof row.bucket!=='string'||typeof row.name!=='string'||row.file!==localName(row.bucket,row.name)||!/^objects\/[a-f0-9]{64}\.bin$/.test(row.file)||files.has(row.file))throw Error('Invalid manifest path');
    files.add(row.file);const file=path.join(target,row.file);
    if((await lstat(file)).isSymbolicLink())throw Error('Symlinks are not accepted');
    const bytes=await readFile(file);if(bytes.length!==row.size||hash(bytes)!==row.sha256)throw Error('Backup checksum mismatch');total+=bytes.length;
  }
  return {buckets:manifest.buckets.length,objects:files.size,bytes:total,verified:true,coverage:'selected-buckets'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    const args=process.argv.slice(2);
    if(args[0]==='--verify'&&args.length===2){console.log(JSON.stringify(await verifyStorage(args[1])));}
    else {
      if(args[0]!=='--out'||!args[1])throw Error('Use --out NEW_PRIVATE_DIRECTORY --bucket item-images');
      const buckets=[];for(let i=2;i<args.length;i+=2){if(args[i]!=='--bucket'||!args[i+1])throw Error('Explicit buckets required');buckets.push(args[i+1]);}
      const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if(!url||!key)throw Error('Server-only backup configuration required');
      const origin=backupConfiguration(url,key);
      const {createClient}=await import('@supabase/supabase-js');
      const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(120_000)})}});
      console.log(JSON.stringify(await exportStorage(client,args[1],buckets,{origin})));
    }
  }catch{console.error('Storage backup failed or incomplete. No remote writes were performed; private errors were not printed.');process.exitCode=1;}
}
