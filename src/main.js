import './style.css';
import { convert, parseLink } from './converter.js';
import { preferredLanguage, t } from './i18n.js';

const $ = (id) => document.getElementById(id);
let savedLanguage;
try { savedLanguage = localStorage.getItem('language'); } catch { /* Storage is optional. */ }
let language = preferredLanguage(navigator.languages || [navigator.language], savedLanguage);
let currentStatus = null;

function renderStatus() {
  $('status').textContent = currentStatus ? t(language, currentStatus.key, currentStatus.params) : '';
  $('status').classList.toggle('error', currentStatus?.error === true);
}

function status(key, params = {}, error = false) {
  currentStatus = key ? { key, params, error } : null;
  renderStatus();
}

function setLanguage(next, remember = false) {
  language = next;
  document.documentElement.lang = language;
  document.title = t(language, 'title');
  document.querySelector('meta[name="description"]').content = t(language, 'description');
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(language, node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t(language, node.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => { node.setAttribute('aria-label', t(language, node.dataset.i18nAria)); });
  document.querySelectorAll('[data-language]').forEach((node) => { node.setAttribute('aria-pressed', String(node.dataset.language === language)); });
  if (currentStatus?.key === 'converted') currentStatus.params.security = currentStatus.params.rawSecurity === 'none' ? t(language, 'noTls') : currentStatus.params.rawSecurity.toUpperCase();
  renderStatus();
  if (remember) { try { localStorage.setItem('language', language); } catch { /* Storage is optional. */ } }
}

document.querySelectorAll('[data-language]').forEach((node) => {
  node.addEventListener('click', () => setLanguage(node.dataset.language, true));
});
setLanguage(language);

function resetResult() {
  $('output').value = '';
  $('copy').disabled = true;
  $('download').disabled = true;
  status(null);
}

$('form').addEventListener('submit', (event) => {
  event.preventDefault();
  resetResult();
  try {
    const config = convert($('link').value, $('tag').value);
    $('tag').value = config.outbounds[0].tag;
    $('output').value = JSON.stringify(config, null, 2) + '\n';
    $('copy').disabled = false;
    $('download').disabled = false;
    $('link').removeAttribute('aria-invalid');
    $('routing-tag').textContent = '"outboundTag": ' + JSON.stringify(config.outbounds[0].tag);
    const stream = config.outbounds[0].streamSettings;
    const names = { tcp: 'TCP / RAW', ws: 'WebSocket', grpc: 'gRPC', xhttp: 'XHTTP', httpupgrade: 'HTTPUpgrade' };
    status('converted', { network: names[stream.network], rawSecurity: stream.security, security: stream.security === 'none' ? t(language, 'noTls') : stream.security.toUpperCase() });
    $('result-title').focus({ preventScroll: true });
    if (matchMedia('(max-width:600px)').matches) $('result-title').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
  } catch (error) {
    $('link').setAttribute('aria-invalid', 'true');
    status(error.code || 'unexpectedError', error.params || {}, true);
    $('link').focus();
  }
});

$('link').addEventListener('input', () => { resetResult(); $('link').removeAttribute('aria-invalid'); });
$('tag').addEventListener('input', resetResult);
$('tag').addEventListener('blur', () => { if (!$('tag').value.trim()) $('tag').value = 'vless-reality'; });
$('form').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); $('form').requestSubmit(); }
});
$('from-link').addEventListener('click', () => {
  resetResult();
  try {
    const url = parseLink($('link').value);
    $('tag').value = decodeURIComponent(url.hash.slice(1)).trim() || url.hostname.replace(/^\[|\]$/g, '');
    status('tagExtracted');
  } catch { status('tagExtractionError', {}, true); }
});
$('clear').addEventListener('click', () => {
  $('link').value = '';
  resetResult();
  $('link').removeAttribute('aria-invalid');
  $('link').focus();
});
$('copy').addEventListener('click', async () => {
  const content = $('output').value;
  if (!content) return;
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('fallback');
    await navigator.clipboard.writeText(content);
    if ($('output').value === content) status('copied');
  } catch {
    if ($('output').value !== content) return;
    $('output').focus(); $('output').select();
    try { if (!document.execCommand('copy')) throw new Error('copy'); status('copied'); }
    catch { status('manualCopy'); }
  }
});
$('download').addEventListener('click', () => {
  if (!$('output').value) return;
  const url = URL.createObjectURL(new Blob([$('output').value], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = '04_outbounds.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('downloaded');
});
