# Deploy — Cloudflare Workers + D1 + KV + R2 + Workers AI

Panduan ini menggantikan deployment Google Apps Script lama. Frontend statik dan API Hono dihoskan sebagai **satu Worker** (Workers Assets + `run_worker_first: ["/api/*"]`).

## 1. Prasyarat

- Akaun Cloudflare dengan Workers, D1, KV, R2 dan Workers AI didayakan.
- Node.js 20+ dan `npm`.
- Akaun Google Cloud untuk OAuth Client.
- Log masuk Wrangler:

  ```powershell
  npx wrangler login
  ```

## 2. Cipta sumber Cloudflare

```powershell
# D1
npx wrangler d1 create jkm-safety-db

# KV
npx wrangler kv namespace create KV

# R2
npx wrangler r2 bucket create jkm-safety-evidence
```

Salin `database_id` dan KV `id` yang dipaparkan ke [`wrangler.jsonc`](./wrangler.jsonc):

```jsonc
"d1_databases": [{ "binding": "DB", "database_name": "jkm-safety-db", "database_id": "<DB_ID>", "migrations_dir": "worker/migrations" }],
"kv_namespaces": [{ "binding": "KV", "id": "<KV_ID>" }],
"r2_buckets": [{ "binding": "R2", "bucket_name": "jkm-safety-evidence" }],
"ai": { "binding": "AI" }
```

## 3. Jalankan migrasi D1

```powershell
npx wrangler d1 migrations apply jkm-safety-db --remote
```

Migrasi mencipta jadual dokumen, baris HIRARC, item checklist, lampiran, aliran semakan, log audit, data induk dan tetapan AI.

> **Naik taraf dari versi sebelum 1.2:** migrasi `0003_system_admin_flag.sql` menambah lajur `users.is_system_admin` dan menukar akaun `pentadbir_sistem` sedia ada kepada peranan `penyelaras_osha` + bendera `is_system_admin = 1` (penugasan bengkel dikekalkan). Selepas itu, bendera Pentadbir Sistem boleh diurus melalui **Urus Pengguna**.

## 4. Google OAuth

1. Google Cloud Console → **APIs & Services → Credentials**.
2. **Create credentials → OAuth client ID → Web application**.
3. **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - URL produksi Worker, contoh `https://portal-keselamatan-jkm.<subdomain>.workers.dev`
4. Tiada redirect URI diperlukan untuk Google Identity Services (aliran ID token).
5. Simpan Client ID.

Tetapkan pada Worker:

```powershell
npx wrangler secret put GOOGLE_CLIENT_ID
```

Dan pada frontend semasa build (fail `.env.production` atau pemboleh ubah persekitaran):

```text
VITE_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
```

## 5. Rahsia penyulitan BYOK

Kunci API Gemini/DeepSeek disimpan sebagai ciphertext AES-GCM. Tetapkan rahsia 32-byte:

```powershell
# Jana nilai rawak
openssl rand -base64 32
npx wrangler secret put AI_KEY_ENCRYPTION_SECRET
```

Tanpa rahsia ini, penyedia BYOK tidak boleh disimpan; Workers AI masih berfungsi.

## 6. Konfigurasi pengeluaran

Semak `vars` dalam [`wrangler.jsonc`](./wrangler.jsonc):

| Var | Produksi |
|---|---|
| `ENVIRONMENT` | `"production"` |
| `DEMO_AUTH_ENABLED` | `"false"` |
| `ALLOWED_EMAIL_DOMAIN` | `"poliku.edu.my"` |
| `ADMIN_EMAILS` | E-mel pentadbir, dipisahkan koma |
| `OSHA_COORDINATOR_EMAILS` | E-mel penyelaras OSHA, dipisahkan koma |
| `AI_MODEL` | Model Workers AI lalai |
| `APP_ORIGIN` | URL frontend jika berbeza origin (pilihan) |

Jika frontend dan API pada origin yang sama, `APP_ORIGIN` tidak diperlukan. Jika berbeza, tetapkan untuk CORS berasaskan credentials.

## 7. Build & deploy

```powershell
npm install
npm run typecheck
npm run deploy
```

`npm run deploy` melakukan tiga perkara: **naik versi patch** (`scripts/version.mjs bump`), `vite build` (menjana `dist/` + `buildId` baharu melalui `prebuild`), kemudian `wrangler deploy`.

Aset statik dihidangkan oleh binding `ASSETS`; laluan `/api/*` sentiasa diarahkan ke Worker.

Selepas deploy, setiap tab yang masih terbuka akan mengesan build baharu melalui `GET /api/version`, menamatkan sesi (`POST /api/auth/logout`), membersihkan cache pelayar dan memuat semula sendiri — pengguna diminta log masuk semula. `npm run deploy:only` **tidak** menaikkan versi — hanya untuk menghantar semula build yang sama.

## 8. Ujian selepas deploy

```powershell
curl https://<worker-url>/api/health
```

Semak:

- `bindings.d1`, `bindings.kv`, `bindings.r2` = `true`
- `bindings.workersAi` = `true`
- `auth.googleConfigured` = `true`
- `auth.demoEnabled` = `false` (produksi)
- `ai.byokEnabled` = `true` jika rahsia penyulitan ditetapkan

Kemudian buka portal dan log masuk dengan akaun `@poliku.edu.my`.

## 9. Pengerasan produksi

- Pastikan `DEMO_AUTH_ENABLED="false"` dan `ENVIRONMENT="production"`.
- Hadkan **Authorized JavaScript origins** Google kepada domain rasmi sahaja.
- Tetapkan `ADMIN_EMAILS` / `OSHA_COORDINATOR_EMAILS` dengan betul; pengguna Google baharu bermula sebagai Penyelia Bengkel.
- Gunakan Google Workspace `hd`/domain sekatan di konsol Google jika tersedia.
- Jangan simpan kunci API AI dalam pemboleh ubah frontend. Hanya masukkan melalui **Tetapan AI** selepas log masuk.
- Sandarkan D1 secara berkala:

  ```powershell
  npx wrangler d1 export jkm-safety-db --remote --output backup-jkm.sql
  ```

- Semak log audit melalui API `/api/audit-logs` atau D1.

## 10. Masalah lazim

| Gejala | Punca | Penyelesaian |
|---|---|---|
| `Sesi tamat` berulang | Cookie pihak ketiga disekat / origin berbeza | Hos frontend & API pada origin sama, atau gunakan `APP_ORIGIN` + HTTPS |
| `Google Sign-In belum dikonfigurasi` | `GOOGLE_CLIENT_ID` atau `VITE_GOOGLE_CLIENT_ID` tiada | Tetapkan kedua-duanya dan build semula |
| `Akses ditolak: hanya akaun @poliku.edu.my` | Domain e-mel tidak dibenarkan | Semak `ALLOWED_EMAIL_DOMAIN` dan akaun Google |
| `no such table` | Migrasi belum dijalankan | `npx wrangler d1 migrations apply jkm-safety-db --remote` |
| AI menggunakan enjin fallback | Workers AI tidak tersedia atau kunci BYOK tidak sah | Semak binding `AI`, tetapan AI, dan log Worker |
| `ai_key_missing` | BYOK dipilih tanpa kunci | Buka **Tetapan AI**, masukkan kunci API |
| `Lampiran melebihi had 8MB` | Had pelayan | Kecilkan fail sebelum muat naik |
| `Forbidden` pada semakan | Dokumen sendiri / luar jabatan | Pemisahan tugas PBAC; gunakan akaun penyemak lain |

## 11. Rollback

```powershell
npx wrangler deployments list
npx wrangler rollback <deployment-id>
```

D1 tidak di-rollback secara automatik. Pulihkan daripada eksport SQL jika perlu.
