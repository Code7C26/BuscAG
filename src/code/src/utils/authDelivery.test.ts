import test from 'node:test';
import assert from 'node:assert/strict';
import {authRedirectForApp,authMailMessage,authErrorMessage} from '../../lib/authFlow';
test('mail redirects remain on the current app origin and reject stale cross-environment configuration',()=>{
 assert.equal(authRedirectForApp('http://127.0.0.1:3001','http://127.0.0.1:3001',true),'http://127.0.0.1:3001/?auth=recovery');
 assert.throws(()=>authRedirectForApp('http://localhost:3000','http://127.0.0.1:3001'),/dirección configurada/);
 assert.throws(()=>authRedirectForApp('https://other.invalid','https://app.invalid'),/dirección configurada/);
 assert.equal(authRedirectForApp(undefined,'https://app.invalid'),'https://app.invalid/');
 assert.equal(authErrorMessage({code:'auth_redirect_mismatch'}).includes('origen'),true);
});
test('signup preserves only a valid public QR token and never forwards callback credentials or an arbitrary return URL',()=>{
 const tag='10000000-0000-4000-8000-000000000001';
 const destination=authRedirectForApp('https://app.invalid',`https://app.invalid/?tag=${tag}&access_token=private&next=https://other.invalid/#refresh_token=private`);
 assert.equal(destination,`https://app.invalid/?tag=${tag}`);
 assert.equal(authRedirectForApp('https://app.invalid',`https://app.invalid/?tag=${tag}`,true),'https://app.invalid/?auth=recovery');
 assert.equal(authRedirectForApp('https://app.invalid','https://app.invalid/?tag=not-a-token'),'https://app.invalid/');
});
test('success responses never assert mail delivery and resend explains confirmed accounts without enumeration',()=>{
 for(const mode of ['signup','reset','resend'] as const){assert.match(authMailMessage(mode),/no (garantiza|confirma) la entrega/);assert.doesNotMatch(authMailMessage(mode),/Te enviamos/);}
 assert.match(authMailMessage('resend'),/ya confirmaste/);
 assert.match(authErrorMessage({code:'email_rate_limit_exceeded'}),/Espera/);
});

test('mail provider restrictions are actionable without reflecting arbitrary server details',()=>{assert.match(authErrorMessage({code:'email_address_not_authorized',message:'PRIVATE'}),/servicio de correo/);assert.doesNotMatch(authErrorMessage({code:'email_address_not_authorized',message:'PRIVATE'}),/PRIVATE/);assert.match(authErrorMessage({code:'email_address_invalid'}),/dirección/);});
