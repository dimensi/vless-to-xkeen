# VLESS → XKeen

A browser-local converter from VLESS share links to Xray outbound JSON for XKeen.

**Website:** https://vless-to-xkeen.pages.dev

**Source:** https://github.com/dimensi/vless-to-xkeen

## Features

- Reads transport and security settings from the link.
- Supports TCP/RAW, WebSocket, gRPC, XHTTP and HTTPUpgrade with compatible TLS, REALITY or no-security configurations.
- Preserves supported connection parameters and reports unknown or incompatible settings instead of silently discarding them.
- Supports a custom tag, a tag extracted from the link name, and `vless-reality` as the fallback for an empty tag.
- Copies or downloads `04_outbounds.json`. Merge the generated outbound into your existing file; keep your other outbounds and match the routing tag.
- Russian and English interface, including validation messages. The initial language follows the browser; an explicit selection is remembered locally. Links and generated configurations are never stored or sent to a server.

Transport compatibility depends on the Xray version installed on the router. mKCP and the removed HTTP/2 and QUIC transports are not converted. Actual server reachability and router imports are not tested by this tool.

## Development

Requires Node.js `^22.18.0`, `^24.11.0` or `>=26.0.0`. The project uses **Vite+** for development, testing and production builds.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The static build is written to `dist/`. No backend or runtime environment variables are required.

## Cloudflare Pages

- Production branch: `main`.
- Build command: `npm test && npm run build`.
- Output directory: `dist`.
- Native Git integration handles builds and deployments; no GitHub Actions workflow or repository deployment secret is needed.
- Every push to `main` runs the tests and Vite+ build in Cloudflare, then publishes the site. Other branches receive preview deployments.
- Node.js is pinned in `.node-version`; the Pages build environment uses the same version.

## По-русски

Вставьте VLESS-ссылку, при необходимости измените тег и нажмите «Конвертировать». Транспорт и защита берутся из самой ссылки. Если тег пустой, используется `vless-reality`.

Переключатель RU / EN меняет весь интерфейс, включая ошибки и подсказки, не очищая введённые данные. На устройстве сохраняется только выбранный язык. Ссылки и конфиги обрабатываются в браузере.

Полученный JSON содержит одно подключение. Добавьте его в существующий `04_outbounds.json`, сохранив остальные подключения, и укажите совпадающий `outboundTag` в правилах маршрутизации.
