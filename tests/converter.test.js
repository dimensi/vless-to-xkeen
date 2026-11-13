import { test } from 'vitest';
import assert from 'node:assert/strict';
import { convert } from '../src/converter.js';
import { messages, preferredLanguage, t } from '../src/i18n.js';

const base='vless://11111111-2222-4333-8444-555555555555@example.com:443';
const pbk=Buffer.alloc(32,1).toString('base64url');
const cases=[
  ['tcp-default','',c=>assert.equal(c.streamSettings.security,'none')],
  ['tcp-tls-vision','type=tcp&security=tls&flow=xtls-rprx-vision&sni=example.com&alpn=h2,http%2F1.1&fp=chrome',c=>{assert.equal(c.settings.vnext[0].users[0].flow,'xtls-rprx-vision');assert.deepEqual(c.streamSettings.tlsSettings.alpn,['h2','http/1.1']);}],
  ['raw-reality',`type=raw&security=reality&pbk=${pbk}&sid=aabb&fp=firefox&flow=xtls-rprx-vision`,c=>assert.equal(c.streamSettings.network,'tcp')],
  ['ws-tls','type=ws&security=tls&path=%2Fedge%3Fed%3D2048&host=cdn.example.com&sni=example.com&allowInsecure=0',c=>{assert.equal(c.streamSettings.wsSettings.path,'/edge?ed=2048');assert.equal(c.streamSettings.wsSettings.headers.Host,'cdn.example.com');assert.equal(c.streamSettings.tlsSettings.allowInsecure,false);}],
  ['websocket-ed','type=websocket&security=none&path=%2Fsocket&ed=1024',c=>assert.equal(c.streamSettings.wsSettings.path,'/socket?ed=1024')],
  ['grpc-tls','type=grpc&security=tls&serviceName=my%2Fservice&authority=cdn.example.com&mode=multi',c=>{assert.equal(c.streamSettings.grpcSettings.serviceName,'my/service');assert.equal(c.streamSettings.grpcSettings.multiMode,true);}],
  ['grpc-reality',`type=grpc&security=reality&pbk=${pbk}&sni=example.com&sid=&alpn=h2&serviceName=test`,c=>assert.equal(c.streamSettings.grpcSettings.serviceName,'test')],
  ['xhttp-reality',`type=xhttp&security=reality&pbk=${pbk}&sni=example.com&path=%2Fapi&mode=packet-up&extra=${encodeURIComponent(JSON.stringify({xPaddingBytes:'100-200'}))}`,c=>assert.equal(c.streamSettings.xhttpSettings.extra.xPaddingBytes,'100-200')],
  ['splithttp-tls','type=splithttp&security=tls&host=example.com&path=%2F&mode=stream-one',c=>assert.equal(c.streamSettings.network,'xhttp')],
  ['httpupgrade','type=httpupgrade&security=tls&path=%2Fup&host=example.com&ed=512',c=>assert.equal(c.streamSettings.httpupgradeSettings.host,'example.com')],
  ['tcp-http','type=tcp&security=none&headerType=http&host=one.example.com,two.example.com&path=%2Fone,%2Ftwo',c=>assert.deepEqual(c.streamSettings.tcpSettings.header.request.path,['/one','/two'])],
];

for (const [name,query,check] of cases) {
  test(name, () => {
    const config=convert(base+(query?'?'+query:''),'custom-test');
    assert.equal(config.outbounds[0].tag,'custom-test');
    check(config.outbounds[0]);
  });
}
test('rejects invalid or unsupported connection settings', () => {
  for(const query of ['type=unknown','type=quic','type=ws&security=reality','type=grpc&flow=xtls-rprx-vision','type=tcp&type=ws','type=ws&ed=wrong','security=reality','type=xhttp&extra=%5B%5D','type=ws&randomSetting=value','security=tls&allowInsecure=bad','type=kcp&security=tls']) assert.throws(()=>convert(base+'?'+query));
});
test('handles default and custom tags, IPv6 and escaped scheme', () => {
  for(const tag of [undefined,'','   ']) assert.equal(convert(base,tag).outbounds[0].tag,'vless-reality');
  assert.equal(convert(base,' my-tag ').outbounds[0].tag,'my-tag');
  assert.equal(convert(base.replace('example.com','[2001:db8::1]')).outbounds[0].settings.vnext[0].address,'2001:db8::1');
  assert.equal(convert(base.replace('vless://','vless\\://')).outbounds[0].tag,'vless-reality');
});
test('provides translations for every converter error', () => {
  assert.deepEqual(Object.keys(messages.ru).sort(),Object.keys(messages.en).sort());
  for(const query of ['type=unknown','type=quic','security=bad','security=reality','type=ws&ed=bad','type=tcp&unknown=1']) {
    try { convert(base+'?'+query); assert.fail('Expected conversion error'); }
    catch(error) { for(const language of ['ru','en']) { assert.ok(messages[language][error.code]); assert.ok(!t(language,error.code,error.params).includes('{')); } }
  }
});
test('chooses saved language first, then browser preference, then English', () => {
  assert.equal(preferredLanguage(['en-US'],'ru'),'ru');
  assert.equal(preferredLanguage(['ru-RU']),'ru');
  assert.equal(preferredLanguage(['de-DE','en-GB']),'en');
  assert.equal(preferredLanguage(['de-DE'],'invalid'),'en');
  assert.equal(t('en','duplicateParam',{key:'type'}),'The link contains a duplicate parameter: type');
});
