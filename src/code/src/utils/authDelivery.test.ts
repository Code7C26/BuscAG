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
test('success responses never assert mail delivery and resend explains confirmed accounts without enumeration',()=>{
 for(const mode of ['signup','reset','resend'] as const){assert.match(authMailMessage(mode),/no (garantiza|confirma) la entrega/);assert.doesNotMatch(authMailMessage(mode),/Te enviamos/);}
 assert.match(authMailMessage('resend'),/ya confirmaste/);
 assert.match(authErrorMessage({code:'email_rate_limit_exceeded'}),/Espera/);
});
