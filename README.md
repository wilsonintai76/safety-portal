# Portal Pengurusan Dokumen Keselamatan JKM

Portal keselamatan bengkel & makmal **Jabatan Kejuruteraan Mekanikal (JKM)**, Politeknik Kuching Sarawak. Dokumen HIRARC (Lampiran 1 PK-06) dan Senarai Semak Pemeriksaan (Lampiran 2B) disimpan secara berpusat di Cloudflare dengan kawalan akses berasaskan polisi (PBAC).

## Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, lucide-react |
| Backend | Cloudflare Workers + [Hono](https://hono.dev) |
| Kontrak API | Hono RPC (`hc<AppType>`) + Zod |
| Pangkalan data | Cloudflare D1 (SQL, model operasi ternormal) |
| Sesi & cache | Cloudflare KV |
| Lampiran | Cloudflare R2 |
| AI | Cloudflare Workers AI (lalai) atau BYOK: Gemini, DeepSeek, OpenAI-compatible |
| Log masuk | Google Identity Services, disahkan JWT di Worker |
| Kawalan akses | PBAC: peranan + atribut jabatan/bengkel/pemilik/status |

## Peranan & PBAC

| Peranan | Skop utama |
|---|---|
| **Penyelaras OSHA Jabatan** | Baca semua dokumen jabatan, semak (`document:review`) dan luluskan (`document:approve`), lihat log audit jabatan. |
| **Penyelia Bengkel / Makmal / Bilik** | Cipta, kemas kini dan hantar dokumen untuk bengkel/makmal sendiri; baca dokumen bengkel sendiri. |
| **Pentadbir Sistem** (bendera, bukan peranan) | Kebenaran penuh **ditambah di atas** peranan fungsi: urus pengguna/peranan, data induk, fasiliti dan audit. |

Peraturan tambahan:

- **Pentadbir Sistem ialah bendera (`users.is_system_admin`), bukan peranan.** Satu akaun boleh menjadi Penyelia Bengkel **dan** Pentadbir Sistem serentak, dan penugasan bengkelnya kekal berfungsi.
- Pendaftaran awam hanya menerima **Penyelaras OSHA** atau **Penyelia Bengkel**; bendera Pentadbir Sistem hanya diberikan oleh pentadbir sedia ada melalui **Urus Pengguna** atau skrip `npm run admin:create` (pangkalan data).
- Migrasi `0003_system_admin_flag.sql` memindahkan akaun `pentadbir_sistem` sedia ada kepada peranan `penyelaras_osha` + `is_system_admin = 1` (penugasan bengkel dikekalkan).
- Sekurang-kurangnya seorang Pentadbir Sistem yang aktif mesti kekal (`last_admin`).
- Pemisahan tugas: penyemak **tidak boleh** menyemak atau meluluskan dokumen sendiri.
- Dokumen hanya boleh diedit semasa status `draf` atau `ditolak`.
- Aliran kerja: `draf → dihantar → disemak → diluluskan` (atau `ditolak`).
- Semua peranan dan kebenaran dikongsi melalui [`shared/roles.ts`](./shared/roles.ts), jadi UI dan Worker menggunakan matriks yang sama.
- **Fasiliti (bengkel / makmal / bilik)** didaftarkan oleh Pentadbir Sistem melalui menu **Urus Fasiliti** (sidebar desktop) atau tab **Fasiliti** pada navigasi bawah mudah alih. Tiada senarai lokasi hardcoded: semua dropdown lokasi (HIRARC, Senarai Semak, Profil, Log Rekod, Dashboard) membaca data `workshops` dari D1 melalui `GET /api/master-data`.
- Fasiliti yang masih mempunyai dokumen atau pengguna ditugaskan **tidak boleh dipadam** (`workshop_in_use`).

## Struktur projek

```text
src/                     Frontend React
  services/api.ts        Klien Hono RPC (typed)
  services/portalApi.ts  Fungsi domain (auth, dokumen, AI, pengguna)
  components/            UI modular (AuthModal, AiSettingsModal, UserManagementModal, WorkshopManagementModal, ...)
worker/src/              Worker Hono
  index.ts               Laluan API + eksport AppType untuk RPC
  pbac.ts                Enjin polisi PBAC
  lib/auth.ts            Google JWT, sesi KV, akaun demo
  lib/documents.ts       CRUD dokumen, aliran kerja, lampiran, audit
  lib/ai.ts              Workers AI + BYOK, cache KV, fallback DOSH
worker/migrations/       Migrasi D1
shared/                  Kontrak dikongsi frontend ↔ backend (roles, dokumen, AI, demo)
```

## Seni bina API: Hono + Hono RPC

- Backend ialah **Hono** yang berjalan di Cloudflare Workers ([`worker/src/index.ts`](./worker/src/index.ts)). Semua laluan di bawah `/api/*` dihidangkan Worker (`run_worker_first`), aset statik oleh binding `ASSETS`.
- Frontend menggunakan **Hono RPC**: klien bertaip `hc<AppType>` ([`src/services/api.ts`](./src/services/api.ts)) yang mengimport `AppType` dari Worker, jadi perubahan laluan/skema memecahkan `tsc` serta-merta — tiada kontrak API bertindih.
- Pengesahan input dibuat di pelayan dengan `zValidator` + Zod (`worker/src/schemas.ts`), bukan di klien.
- **Satu sumber data:** D1 (dokumen, pengguna, data induk), KV (sesi 12 jam, cache AI, rate limit), R2 (lampiran). Pelayar tidak menyimpan data rasmi.

## Versi & kemas kini automatik

`version.json` ialah **satu-satunya sumber versi**; ia diimport oleh bundle Vite ([`src/services/version.ts`](./src/services/version.ts)) dan oleh Worker.

| Langkah | Mekanisme |
|---|---|
| Naik versi | `npm run deploy` → [`scripts/version.mjs bump`](./scripts/version.mjs) naikkan semver *patch* (boleh `bump minor/major` manual) |
| Build ID | `prebuild` menjalankan `version.mjs build` → `buildId = v<semver>-<cap masa>` dan `builtAt` |
| Agihan | `wrangler deploy` menghantar aset + Worker yang membaca `version.json` yang sama |
| Semakan | `GET /api/version` memulangkan `{ version, buildId, builtAt }` dengan `Cache-Control: no-store` |
| Pengesanan | [`UpdateBanner`](./src/components/UpdateBanner.tsx) tinjau setiap 60 saat + pada `focus`/`visibilitychange`/`pageshow`(bfcache) |
| Tindakan | Jika `buildId` ≠ `APP_BUILD_ID` bundle → banner + kira detik 15 saat → muat semula |

Muat semula selepas kemas kini ([`reloadWithBuild`](./src/services/version.ts)):

1. **Tamatkan sesi pelayan** — `POST /api/auth/logout` (KV + cookie HttpOnly), jadi build baharu bermula dengan kelayakan bersih dan pengguna log masuk semula.
2. Padam semua entri **Cache API** (`caches.delete`), buang token bearer `sessionStorage`, dan buang snapshot profil lama jika ada.
3. Navigasi ke URL dengan `?v=<buildId>` — kunci cache URL berubah, jadi `index.html` baharu tidak boleh datang dari cache lama (aset Vite juga ber-hash).
4. Guard `sessionStorage.jkm_update_attempt` menghalang gelung muat semula jika CDN masih menghidangkan build lama.
5. Draf borang **di-flush** pada `beforeunload`/`pagehide` dan **dikekalkan** merentas kemas kini (ia kerja pengguna, bukan cache) — draf dimuatkan semula untuk pemiliknya selepas log masuk.

Sesi aktif lain yang tidak membuka portal akan terus sah sehingga tamat tempoh 12 jam; tab yang membuka portal selepas deploy akan log masuk semula secara automatik diminta. `npm run deploy:only` tidak menaikkan versi — gunakannya hanya untuk menghantar semula build yang sama.

## Identiti & storan pelayar

Identiti, peranan dan kebenaran **tidak pernah** disimpan dalam pelayar. Setiap boot memaparkan splash ringkas “Memulihkan sesi…” sementara `/api/me` disahkan; jika 401, portal terus ke halaman log masuk.

| Kunci | Jenis | Kegunaan | Hayat |
|---|---|---|---|
| `jkm_api_token` | sessionStorage | Token bearer selepas log masuk; cookie HttpOnly tetap sumber sebenar | Dipadam pada log keluar & kemas kini versi |
| `jkm_autosave_hirarc_v1`, `jkm_autosave_checklist_v1` | localStorage | Draf 30 saat (bertag `ownerId`, diabaikan jika akaun berbeza) | Dipadam selepas hantar, reset draf atau log keluar |
| `jkm_sidebar_collapsed` | localStorage | Keutamaan UI sidebar | Kekal |
| `jkm_update_attempt` | sessionStorage | Guard anti-gelung reload selepas kemas kini | Dipadam apabila build terkini sudah berjalan |

`jkm_session_cache_v1` (snapshot profil) daripada build lama dibuang secara automatik pada boot/keluar. Semua data rasmi (dokumen, lampiran, pengguna, fasiliti, audit) hanya wujud dalam D1/KV/R2.

## Pembangunan tempatan

1. Pasang dependensi:

   ```powershell
   npm install
   ```

2. Salin konfigurasi pembangunan dan jana rahsia penyulitan kunci AI:

   ```powershell
   Copy-Item .dev.vars.example .dev.vars
   # Edit .dev.vars, tetapkan AI_KEY_ENCRYPTION_SECRET yang panjang.
   ```

3. Jalankan migrasi D1 tempatan:

   ```powershell
   npm run db:migrate:local
   ```

4. Mulakan frontend + Worker serentak:

   ```powershell
   npm run dev:all
   ```

   - Frontend: <http://localhost:3000>
   - API: <http://127.0.0.1:8787/api/health>
   - Vite memproksi `/api` ke Worker.

### Akaun demo

Log masuk demo hanya aktif apabila `DEMO_AUTH_ENABLED="true"` dan `ENVIRONMENT` bukan `production`.

| E-mel | Peranan |
|---|---|
| `wilson.intai@poliku.edu.my` | Pentadbir Sistem |
| `osha.jkm@poliku.edu.my` | Penyelaras OSHA Jabatan |
| `faiz.musa@poliku.edu.my` | Penyelia Bengkel |
| `huda.rosli@poliku.edu.my` | Penyelia Bengkel |

## Log masuk Google

1. Cipta OAuth Client (Web application) dalam Google Cloud Console.
2. Tetapkan **Authorized JavaScript origins**: `http://localhost:3000` dan domain produksi.
3. Frontend: `VITE_GOOGLE_CLIENT_ID`.
4. Worker: `GOOGLE_CLIENT_ID` (secret/var).
5. Worker mengesahkan tandatangan JWT Google melalui JWKS (cache KV), semakan `aud`, `iss`, `exp`, `email_verified`, dan domain `ALLOWED_EMAIL_DOMAIN` (`poliku.edu.my`).

Akaun Google baharu dijana secara automatik sebagai **Penyelia Bengkel**. Pentadbir Sistem boleh menukar peranan melalui butang **Pengguna** dalam header.

## AI: Workers AI lalai, BYOK pilihan

- Lalai: binding `AI` Cloudflare, model `@cf/meta/llama-3.1-8b-instruct` (boleh ubah melalui `AI_MODEL`).
- BYOK: Gemini, DeepSeek atau mana-mana endpoint serasi OpenAI (`/chat/completions`).
- Kunci API BYOK disulitkan **AES-GCM** menggunakan `AI_KEY_ENCRYPTION_SECRET` sebelum disimpan dalam D1. Kunci tidak pernah dihantar semula ke pelayar.
- Cache jawapan AI dalam KV selama 24 jam; had kadar 30 permintaan/minit/pengguna.
- Jika penyedia AI gagal, portal memaparkan amaran dan menggunakan enjin cadangan DOSH/JKKP setempat.

Tetapan AI boleh diubah melalui **Tetapan AI** dalam header atau butang pada langkah kawalan HIRARC.

## API utama

| Kaedah | Laluan | Keterangan |
|---|---|---|
| GET | `/api/health` | Status binding D1/KV/R2/AI dan konfigurasi auth |
| POST | `/api/auth/google` | Tukar ID token Google kepada sesi |
| POST | `/api/auth/demo` | Log masuk demo (jika didayakan) |
| GET | `/api/me` | Profil + kebenaran PBAC |
| PATCH | `/api/me` | Kemas kini nama penuh sendiri |
| GET/POST | `/api/documents` | Senarai/cipta dokumen (skop PBAC) |
| PATCH | `/api/documents/:id` | Kemas kini draf |
| POST | `/api/documents/:id/submit` | Hantar untuk semakan |
| POST | `/api/documents/:id/review` | `semak` / `lulus` / `tolak` |
| POST | `/api/documents/:id/attachments` | Muat naik lampiran ke R2 |
| GET | `/api/attachments/:id` | Muat turun lampiran (semakan PBAC) |
| GET/PUT | `/api/ai/settings` | Tetapan penyedia AI |
| POST | `/api/ai/suggest` | Cadangan kawalan AI |
| GET/PATCH | `/api/users` | Pentadbir sahaja |
| GET | `/api/audit-logs` | Log audit mengikut skop |
| GET | `/api/master-data` | Jabatan, bengkel, matriks risiko, peranan |

## Skrip

| Skrip | Tujuan |
|---|---|
| `npm run dev` | Frontend Vite sahaja |
| `npm run dev:api` | Worker Wrangler sahaja |
| `npm run dev:all` | Frontend + Worker |
| `npm run typecheck` | `tsc --noEmit` (frontend, Worker, shared) |
| `npm test` | Ujian unit PBAC (`worker/src/pbac.test.ts`) |
| `npm run build` | Bina frontend ke `dist/` |
| `npm run db:migrate:local` | Migrasi D1 tempatan |
| `npm run db:migrate:remote` | Migrasi D1 produksi |
| `npm run deploy` | Build + `wrangler deploy` |

Lihat [DEPLOY.md](./DEPLOY.md) untuk langkah deployment Cloudflare.
