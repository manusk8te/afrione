const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs',moduleResolution:'node'});
require('ts-node/register/transpile-only');
const {safeAuthRedirect,recoveryLinkError,recoveryErrorMessage,verifyRecoveryCode}=require('../src/lib/auth-recovery.ts');
test('la redirection de connexion reste dans AfriOne',()=>{
 for(const input of ['https://evil.example','//evil.example','/\\evil.example',null])assert.equal(safeAuthRedirect(input),'/diagnostic');
 assert.equal(safeAuthRedirect('/diagnostic?test=1'),'/diagnostic?test=1');
});
test('lien expiré : message explicite sans révéler le contenu du lien',()=>{
 assert.match(recoveryLinkError('#error=access_denied&error_code=otp_expired&secret=PRIVATE',''),/expiré/);
 assert.ok(!recoveryLinkError('#error=access_denied&secret=PRIVATE','').includes('PRIVATE'));
 assert.equal(recoveryLinkError('#access_token=private',''),'');
});
test('un code incomplet ne déclenche pas de requête',async()=>{
 let called=false;const client={auth:{verifyOtp:async()=>{called=true;}}};
 await assert.rejects(()=>verifyRecoveryCode(client,'test@example.com','123'),/Code invalide/);
 await assert.rejects(()=>verifyRecoveryCode(client,'incorrect','123456'),/Adresse email invalide/);
 assert.equal(called,false);
});
test('le code utilise exclusivement le parcours recovery Supabase',async()=>{
 let received;const session={fixture:true};
 const client={auth:{verifyOtp:async input=>{received=input;return {data:{session},error:null}}}};
 assert.equal(await verifyRecoveryCode(client,' test@example.com ','123 456'),session);
 assert.deepEqual(received,{email:'test@example.com',token:'123456',type:'recovery'});
});
test('aucun accès ne résulte d’un code refusé ou d’une session absente',async()=>{
 const error=new Error('Token expired');
 await assert.rejects(()=>verifyRecoveryCode({auth:{verifyOtp:async()=>({data:{session:null},error})}},'test@example.com','123456'),/expired/);
 await assert.rejects(()=>verifyRecoveryCode({auth:{verifyOtp:async()=>({data:{session:null},error:null})}},'test@example.com','123456'),/Session de récupération absente/);
 assert.match(recoveryErrorMessage(error),/dernier email/);
});
