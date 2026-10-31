// Isolated HTTP workflow test. Credentials stay in memory; fixtures are removed in finally.
import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base=process.env.TEST_BASE_URL;if(!base)throw Error('TEST_BASE_URL required');
const url='https://bfvziiajxhjoqfefkwwm.supabase.co';
const raw=await readFile('/Users/goblyemmanuel/Downloads/afrione-complete/.env.local','utf8');
const token=raw.split(/\r?\n/).find(l=>l.startsWith('SUPABASE_ACCESS_TOKEN=')).split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g,'');
const kr=await fetch('https://api.supabase.com/v1/projects/bfvziiajxhjoqfefkwwm/api-keys',{headers:{Authorization:'Bearer '+token}});if(!kr.ok)throw Error('Configuration unavailable');
const keys=await kr.json();const key=n=>keys.find(k=>k.name===n)?.api_key;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,key('service_role'),options),actors={},ids=[],jobs=[],profiles=[],objects=[],checks=[];
const ok=(v,label)=>{if(!v)throw Error(label);checks.push(label)};
const db=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
async function api(who,path,body,fail=false){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+actors[who].token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(fail){ok(!r.ok,'Blocked '+(body?.action??path));return j}if(!r.ok)throw Error(path+' '+r.status+' '+j.error);return j}
const action=(who,m,act,extra={},fail=false)=>api(who,'/api/mission/workflow',{mission_id:m,action:act,...extra},fail);
async function agreement(who,m,act,payload={},fail=false){const current=await api(who,'/api/warroom/agreement?mission_id='+m);return api(who,'/api/warroom/agreement',{mission_id:m,action:act,version:current.agreement?.version??0,payload},fail)}
async function mission(){const m=await db(admin.from('missions').insert({client_id:actors.client.id,category:'Plomberie',is_test:true}).select('id').single());jobs.push(m.id);return m.id}
const proposal={scope:'[TEST] Remplacer le mitigeur de cuisine hors matériel',reason:'[TEST] Dépose et pose avec contrôle de l’étanchéité',amount:45000,supplies:'excluded'};
let failure;
try{
 for(const [name,role] of [['client','client'],['provider','artisan'],['other','client'],['moderator','admin']]){
  const email='workflow-'+randomUUID()+'@afrione.test',password=randomUUID()+randomUUID();
  const r=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'[TEST] '+name},app_metadata:{afrione_test:true}});if(r.error)throw Error(r.error.message);const id=r.data.user.id;ids.push(id);
  await db(admin.from('users').upsert({id,name:'[TEST] '+name,email,role}));const client=createClient(url,key('anon'),options);const login=await client.auth.signInWithPassword({email,password});if(login.error)throw Error(login.error.message);actors[name]={id,client,token:login.data.session.access_token};
 }
 for(const name of ['client','provider']){const p=await db(admin.from('artisan_pros').insert({user_id:actors[name].id,metier:'Plomberie',kyc_status:'approved',is_available:true,is_test:true}).select('id').single());profiles.push(p.id);actors[name].profile=p.id}
 const anon=createClient(url,key('anon'),options);const visible=await db(anon.from('artisan_pros').select('id').in('id',profiles));ok(visible.length===0,'Test providers hidden from public directory');
 const m=await mission();await action('client',m,'request_provider',{artisan_id:actors.client.profile},true);await action('client',m,'request_provider',{artisan_id:actors.provider.profile});await action('other',m,'accept_assignment',{},true);await action('provider',m,'accept_assignment');
 await agreement('client',m,'confirm',{scope:proposal.scope,discussion:true});await api('client','/api/warroom/messages',{mission_id:m,text:'[TEST] Le mitigeur neuf est disponible sur place.'});await api('provider','/api/warroom/messages',{mission_id:m,text:'[TEST] Je propose la dépose, la pose et le contrôle des raccords.'});const chat=await api('client','/api/warroom/messages?mission_id='+m);ok(chat.messages.filter(x=>x.type==='text').length===2,'Both participants exchange and fetch messages');await api('other','/api/warroom/messages?mission_id='+m,undefined,true);await agreement('provider',m,'propose',proposal);await agreement('client',m,'counter',{...proposal,amount:38000});await agreement('client',m,'accept',{},true);await agreement('provider',m,'accept_counter');await agreement('client',m,'accept');
 let q=await api('client','/api/quote?mission_id='+m);ok(q.total===38000,'Negotiated price confirmed at 38000 FCFA');
 await agreement('provider',m,'propose',{...proposal,amount:42000});await action('client',m,'pay_test',{quote_revision:q.quote_revision},true);await agreement('client',m,'reject');q=await api('client','/api/quote?mission_id='+m);ok(q.total===38000,'Rejected increase preserves price');
 await action('client',m,'pay_test',{quote_revision:q.quote_revision});const scheduled=await action('client',m,'start_now');ok(scheduled.status==='scheduled','Client confirmation does not declare provider departure');await action('client',m,'start_tracking',{},true);await action('provider',m,'start_tracking');const arrived=await action('provider',m,'arrived');ok(arrived.status==='en_route','Provider cannot self-confirm arrival');await action('client',m,'confirm_arrival');await action('provider',m,'done',{},true);
 const filename='proof/'+m+'/test.png';objects.push(filename);const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');await db(actors.provider.client.storage.from('portfolio').upload(filename,png,{contentType:'image/png'}));
 const photo=url+'/storage/v1/object/public/portfolio/'+filename;await api('provider','/api/mission/proof',{mission_id:m,photos:[photo],notes:'[TEST] Photo de contrôle : mission fictive, aucun travail réel.'});await action('provider',m,'done');await action('provider',m,'validate',{},true);await action('client',m,'validate');await action('client',m,'validate');const instructions=await db(admin.from('payment_instructions').select('id,status').eq('mission_id',m));ok(instructions.length===1&&instructions[0].status==='simulated','One simulated release after duplicate validation');
 const m2=await mission();await action('client',m2,'request_provider',{artisan_id:actors.provider.profile});await action('provider',m2,'accept_assignment');await agreement('client',m2,'confirm',{scope:proposal.scope,discussion:false});await agreement('provider',m2,'propose',{...proposal,amount:12000});await agreement('client',m2,'accept');q=await api('client','/api/quote?mission_id='+m2);await action('client',m2,'pay_test',{quote_revision:q.quote_revision});await action('client',m2,'start_now');await action('provider',m2,'start_tracking');await action('client',m2,'dispute',{reason:'[TEST] Prestataire absent du rendez-vous convenu.'});await action('client',m2,'validate',{},true);
 await api('moderator','/api/admin/data',{action:'close_litige',missionId:m2,favor:'client',reason:'[TEST] Absence de prestation vérifiée dans ce scénario fictif.'});const refund=await db(admin.from('payment_instructions').select('kind,status').eq('mission_id',m2));ok(refund.length===1&&refund[0].kind==='refund'&&refund[0].status==='simulated','Dispute resolved with one simulated refund');
 const m3=await mission();await action('client',m3,'request_provider',{artisan_id:actors.provider.profile});const refused=await action('provider',m3,'reject_assignment');ok(refused.status==='matching','Provider refusal returns mission to matching');await action('client',m3,'cancel');await action('client',m3,'request_provider',{artisan_id:actors.provider.profile},true);
}catch(e){failure=e.message;console.log(JSON.stringify({stage:'test_failure',error:failure,checks:checks.length}))}
finally{
 if(objects.length)await db(admin.storage.from('portfolio').remove(objects));
 for(const table of ['payment_instructions','payment_simulations','chat_history','gps_tracking','proof_of_work','discussion_agreements','mission_events','diagnostics','transactions'])if(jobs.length)await db(admin.from(table).delete().in('mission_id',jobs));
 if(jobs.length)await db(admin.from('missions').delete().in('id',jobs));
 if(profiles.length)await db(admin.from('artisan_pros').delete().in('id',profiles));
 if(ids.length){await db(admin.from('users').delete().in('id',ids));for(const id of ids){const r=await admin.auth.admin.deleteUser(id);if(r.error)throw Error(r.error.message)}}
 const result={result:failure?'FAIL':'PASS',base,checks:checks.length,scenarios:checks,accounts:ids.length,missions:jobs.length,fixturesRemoved:true,...(failure?{error:failure}:{})};console.log(JSON.stringify(result,null,2));await writeFile('../work/mission-logic/http-result.json',JSON.stringify(result,null,2));
}
if(failure)process.exitCode=1;
