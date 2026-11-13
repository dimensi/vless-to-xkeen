function fail(code, params={}) { throw Object.assign(new Error(code), {code,params}); }

export function parseLink(link) {
  if (!link.trim()) fail('emptyLink');
  let url;
  try { url = new URL(link.trim().replace(/^vless\\:\/\//i, 'vless://')); }
  catch { fail('invalidLink'); }
  if (url.protocol !== 'vless:' || !url.hostname || !url.username || url.password)
    fail('invalidLink');
  return url;
}

export function convert(link, tag='vless-reality') {
  tag=tag.trim() || 'vless-reality';
  const url=parseLink(link), p=url.searchParams;
  let id;
  try { id=decodeURIComponent(url.username); }
  catch { fail('invalidIdEncoding'); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    fail('invalidId');
  const port=url.port ? Number(url.port) : 443;
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('invalidPort');
  const address=url.hostname.replace(/^\[|\]$/g,'');
  const aliases={tcp:'tcp',raw:'tcp',ws:'ws',websocket:'ws',grpc:'grpc',xhttp:'xhttp',splithttp:'xhttp',httpupgrade:'httpupgrade'};
  const type=(p.get('type') || 'tcp').toLowerCase(), network=aliases[type];
  if (['kcp','mkcp'].includes(type)) fail('unsupportedKcp');
  if (['h2','h3','http','quic'].includes(type))
    fail('removedTransport',{type});
  if (!network) fail('unsupportedTransport',{type});
  const security=(p.get('security') || 'none').toLowerCase();
  if (!['none','tls','reality'].includes(security)) fail('unsupportedSecurity',{security});
  if (security==='reality' && !['tcp','grpc','xhttp'].includes(network))
    fail('incompatibleReality');

  // Each accepted parameter must belong to the selected transport/security.
  // Refuse unknown settings rather than silently discarding connection data.
  const used=new Set(['type','security','encryption','flow']);
  const get=(key)=>{used.add(key);return p.get(key);};
  const optional=(target,key,param=key)=>{const value=get(param);if(value) target[key]=value;};
  const boolean=(key)=>{
    const value=get(key);
    if(value===null || value==='') return undefined;
    if(value==='1' || value==='true') return true;
    if(value==='0' || value==='false') return false;
    fail('invalidBoolean',{key});
  };
  const user={id,encryption:p.get('encryption') || 'none'};
  const flow=p.get('flow');
  if(flow) {
    if(!['xtls-rprx-vision','xtls-rprx-vision-udp443'].includes(flow)) fail('unsupportedFlow',{flow});
    if(network!=='tcp' || security==='none') fail('incompatibleFlow');
    user.flow=flow;
  }
  const stream={network,security};
  if(security==='tls') {
    const tls={};
    optional(tls,'serverName','sni');optional(tls,'fingerprint','fp');
    const alpn=get('alpn');if(alpn) tls.alpn=alpn.split(',').map(v=>v.trim()).filter(Boolean);
    const allow=boolean('allowInsecure'), insecure=boolean('insecure');
    if(allow!==undefined && insecure!==undefined && allow!==insecure) fail('conflictingTLSFlags');
    if(allow!==undefined || insecure!==undefined) tls.allowInsecure=allow ?? insecure;
    optional(tls,'echConfigList','ech');optional(tls,'pinnedPeerCertSha256','pcs');optional(tls,'verifyPeerCertByName','vcn');
    stream.tlsSettings=tls;
  } else if(security==='reality') {
    const key=get('pbk') || '', sid=get('sid') || '';
    if(!/^[A-Za-z0-9_-]{43}$/.test(key) || atob(key.replace(/-/g,'+').replace(/_/g,'/')+'=').length!==32)
      fail('invalidRealityKey');
    if(!/^(?:[0-9a-f]{2}){0,8}$/i.test(sid)) fail('invalidShortId');
    const reality={fingerprint:get('fp') || 'chrome',publicKey:key,shortId:sid};
    optional(reality,'serverName','sni');optional(reality,'spiderX','spx');optional(reality,'mldsa65Verify','pqv');
    // REALITY has no configurable alpn field: the selected fingerprint determines it.
    get('alpn');
    stream.realitySettings=reality;
  }

  if(network==='tcp') {
    const header=get('headerType') || 'none';
    if(!['none','http'].includes(header)) fail('invalidTcpHeader');
    if(header==='http') {
      const host=get('host'),path=get('path');
      const request={};
      if(host) request.headers={Host:host.split(',').map(v=>v.trim())};
      if(path) request.path=path.split(',');
      stream.tcpSettings={header:{type:'http',request}};
    }
  } else if(network==='ws' || network==='httpupgrade') {
    let path=get('path') || '/';
    const host=get('host'),ed=get('ed');
    if(ed) {
      if(!/^\d+$/.test(ed) || Number(ed)>65535) fail('invalidEarlyData');
      const parsed=new URL(path,'https://placeholder.invalid');
      if(parsed.searchParams.has('ed') && parsed.searchParams.get('ed')!==ed) fail('conflictingEarlyData');
      parsed.searchParams.set('ed',ed);path=parsed.pathname+parsed.search;
    }
    const eh=get('eh');
    if(eh && eh.toLowerCase()!=='sec-websocket-protocol') fail('unsupportedEarlyHeader',{header:eh});
    const settings={path};
    if(host) {
      if(network==='ws') settings.headers={Host:host};
      else settings.host=host;
    }
    stream[network==='ws'?'wsSettings':'httpupgradeSettings']=settings;
  } else if(network==='grpc') {
    const mode=get('mode') || 'gun';
    if(!['gun','multi'].includes(mode)) fail('invalidGrpcMode');
    const grpc={serviceName:get('serviceName') || '',multiMode:mode==='multi'};
    optional(grpc,'authority');stream.grpcSettings=grpc;
  } else if(network==='xhttp') {
    const mode=get('mode') || 'auto';
    if(!['auto','packet-up','stream-up','stream-one'].includes(mode)) fail('invalidXhttpMode',{mode});
    const xhttp={path:get('path') || '/',mode};
    optional(xhttp,'host');
    const extra=get('extra');
    if(extra) {
      try { xhttp.extra=JSON.parse(extra); }
      catch { fail('invalidExtra'); }
      if(!xhttp.extra || typeof xhttp.extra!=='object' || Array.isArray(xhttp.extra)) fail('invalidExtra');
    }
    stream.xhttpSettings=xhttp;

  }
  for(const key of p.keys()) {
    if(p.getAll(key).length!==1) fail('duplicateParam',{key});
    // Empty export placeholders do not carry a connection setting.
    if(!used.has(key) && p.get(key)!=='') fail('unsupportedParam',{key,type,security});
  }
  return {outbounds:[{tag,protocol:'vless',settings:{vnext:[{address,port,users:[user]}]},streamSettings:stream}]};
}

