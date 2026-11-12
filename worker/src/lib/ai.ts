import {
  AI_PROVIDER_CATALOG,
  getAiProviderInfo,
  riskLevelFromScore,
  type AiHierarchy,
  type AiProvider,
  type AiSettingsDTO,
  type AiSuggestionResultDTO
} from '../../../shared/ai';
import type { AiSettingsInput, AiSuggestionInput } from '../schemas';
import type { Bindings, SessionUser } from '../types';
import { can } from '../pbac';
import { assert, HttpError } from './http';
import { writeAudit } from './documents';

interface AiSettingsRow {
  user_id: string;
  provider: AiProvider;
  model: string;
  base_url: string;
  api_key_cipher: string | null;
  api_key_hint: string | null;
  updated_at: string;
}

interface ProviderText {
  text: string;
  hierarchy?: AiHierarchy;
}

const SYSTEM_PROMPT = `Anda ialah Safety and Health Officer (SHO) bertauliah DOSH/JKKP Malaysia yang pakar dalam standard PK-06(1)(01-07-22) untuk bengkel kejuruteraan mekanikal politeknik.
Tugas anda: cadangkan langkah kawalan risiko mengikut Hierarki Kawalan (Penghapusan, Penggantian, Kejuruteraan, Pentadbiran, PPE).
Format jawapan:
- Bahasa Melayu ringkas dan praktikal.
- Senaraikan bullet mengikut hierarki.
- Fokus pada mesin, hazard dan tahap risiko yang diberi.
- Jangan beri nasihat perubatan atau undang-undang yang mengelirukan.`;

function buildUserPrompt(input: AiSuggestionInput): string {
  const score = input.likelihood * input.severity;
  const level = input.riskLevel || riskLevelFromScore(score);
  return `Penilaian Risiko HIRARC Bengkel JKM:
- Aktiviti Kerja: ${input.workActivity || 'Operasi Mesin Bengkel'}
- Hazard: ${input.hazard || 'Hazard Mekanikal'}
- Kesan / Akibat: ${input.effect || 'Kecederaan'}
- Kawalan Sedia Ada: ${input.existingControl || 'SOP Asas'}
- Lokasi: ${input.workshop || 'Bengkel JKM'}
- L=${input.likelihood}/5, S=${input.severity}/5, Skor=${score} (${level})

Cadangkan langkah kawalan mengikut hierarki: Kejuruteraan, Pentadbiran dan PPE.`;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(env: Bindings): Promise<CryptoKey | null> {
  if (!env.AI_KEY_ENCRYPTION_SECRET) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(env.AI_KEY_ENCRYPTION_SECRET)
  );
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptApiKey(env: Bindings, apiKey: string): Promise<string> {
  const key = await encryptionKey(env);
  assert(
    key,
    503,
    'Penyulitan kunci API belum dikonfigurasi. Pentadbir perlu menetapkan AI_KEY_ENCRYPTION_SECRET.',
    'ai_encryption_not_configured'
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(apiKey)
  );
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

async function decryptApiKey(env: Bindings, cipher: string): Promise<string> {
  const key = await encryptionKey(env);
  assert(key, 503, 'Kunci penyulitan API tidak dikonfigurasi.', 'ai_encryption_not_configured');
  const parts = cipher.split('.');
  assert(parts.length === 3 && parts[0] === 'v1', 500, 'Format kunci API tersimpan tidak sah.', 'ai_key_corrupt');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(parts[1]) as BufferSource },
    key,
    fromBase64(parts[2]) as BufferSource
  );
  return new TextDecoder().decode(plain);
}

function keyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

async function getSettingsRow(env: Bindings, userId: string): Promise<AiSettingsRow | null> {
  return env.DB.prepare('SELECT * FROM user_ai_settings WHERE user_id = ?')
    .bind(userId)
    .first<AiSettingsRow>();
}

function defaultModel(env: Bindings, provider: AiProvider): string {
  if (provider === 'cloudflare') {
    return env.AI_MODEL || getAiProviderInfo('cloudflare').defaultModel;
  }
  return getAiProviderInfo(provider).defaultModel;
}

export async function getAiSettings(env: Bindings, user: SessionUser): Promise<AiSettingsDTO> {
  assert(can(user, 'ai:suggest'), 403, 'Anda tiada akses kepada tetapan AI.', 'forbidden');
  const row = await getSettingsRow(env, user.userId);
  const provider = row?.provider ?? 'cloudflare';
  return {
    provider,
    model: row?.model || defaultModel(env, provider),
    baseUrl: row?.base_url ?? '',
    hasApiKey: Boolean(row?.api_key_cipher),
    apiKeyHint: row?.api_key_hint ?? null,
    encryptionReady: Boolean(env.AI_KEY_ENCRYPTION_SECRET),
    providers: AI_PROVIDER_CATALOG
  };
}

export async function saveAiSettings(
  env: Bindings,
  user: SessionUser,
  input: AiSettingsInput
): Promise<AiSettingsDTO> {
  assert(can(user, 'ai:suggest'), 403, 'Anda tiada akses kepada tetapan AI.', 'forbidden');

  const info = getAiProviderInfo(input.provider);
  const existing = await getSettingsRow(env, user.userId);
  const sameProvider = existing?.provider === input.provider;
  const now = new Date().toISOString();
  const requestedKey = input.apiKey?.trim() ?? '';

  let cipher: string | null = null;
  let hint: string | null = null;

  if (info.requiresApiKey && !input.clearApiKey) {
    if (requestedKey) {
      cipher = await encryptApiKey(env, requestedKey);
      hint = keyHint(requestedKey);
    } else if (sameProvider && existing?.api_key_cipher) {
      cipher = existing.api_key_cipher;
      hint = existing.api_key_hint;
    }
  }

  const baseUrl = input.provider === 'openai_compatible' ? validateBaseUrl(input.baseUrl) : '';
  if (info.requiresBaseUrl) {
    assert(baseUrl, 400, 'URL asas diperlukan untuk penyedia serasi OpenAI.', 'invalid_base_url');
  }

  const model = input.model?.trim() || defaultModel(env, input.provider);

  await env.DB.prepare(
    `INSERT INTO user_ai_settings
       (user_id, provider, model, base_url, api_key_cipher, api_key_hint, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       provider = excluded.provider,
       model = excluded.model,
       base_url = excluded.base_url,
       api_key_cipher = excluded.api_key_cipher,
       api_key_hint = excluded.api_key_hint,
       updated_at = excluded.updated_at`
  )
    .bind(user.userId, input.provider, model, baseUrl, cipher, hint, now)
    .run();

  await writeAudit(env, user, 'ai.settings.update', 'ai_settings', user.userId, {
    provider: input.provider,
    model,
    hasApiKey: Boolean(cipher)
  });

  return getAiSettings(env, user);
}

function validateBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  const allowed =
    /^https:\/\//i.test(trimmed) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed);
  assert(allowed, 400, 'URL asas mesti menggunakan HTTPS (atau localhost untuk pembangunan).', 'invalid_base_url');
  return trimmed;
}

function providerError(data: unknown, status: number): string {
  const payload = data as {
    error?: { message?: string; status?: string };
    message?: string;
  };
  return payload?.error?.message || payload?.error?.status || payload?.message || `HTTP ${status}`;
}

async function callCloudflare(env: Bindings, model: string, input: AiSuggestionInput): Promise<ProviderText> {
  const ai = env.AI as unknown as {
    run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
  };
  const result = await ai.run(model, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) }
    ],
    max_tokens: 800,
    temperature: 0.3
  });

  const payload = result as { response?: string; description?: string };
  const text = payload?.response || payload?.description || (typeof result === 'string' ? result : '');
  assert(text, 502, 'Workers AI tidak memulangkan cadangan.', 'ai_empty_response');
  return { text: text.trim() };
}

async function callGemini(
  apiKey: string,
  model: string,
  input: AiSuggestionInput
): Promise<ProviderText> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input) }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
      })
    }
  );

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = providerError(data, response.status);
    if (response.status === 401 || response.status === 403 || /api key/i.test(message)) {
      throw new HttpError(401, `Kunci API Gemini ditolak: ${message}`, 'ai_auth_failed');
    }
    throw new HttpError(502, `Gemini gagal: ${message}`, 'ai_provider_error');
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
  assert(text, 502, 'Gemini tidak memulangkan cadangan.', 'ai_empty_response');
  return { text };
}

async function callOpenAiCompatible(
  provider: 'deepseek' | 'openai_compatible',
  apiKey: string,
  model: string,
  baseUrl: string,
  input: AiSuggestionInput
): Promise<ProviderText> {
  const base = provider === 'deepseek' ? 'https://api.deepseek.com' : validateBaseUrl(baseUrl);
  assert(base, 400, 'URL asas penyedia AI diperlukan.', 'invalid_base_url');
  const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) }
      ],
      temperature: 0.3,
      max_tokens: 900
    })
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = providerError(data, response.status);
    if (response.status === 401 || response.status === 403 || /api key|unauthorized/i.test(message)) {
      throw new HttpError(401, `Kunci API ditolak: ${message}`, 'ai_auth_failed');
    }
    throw new HttpError(502, `Penyedia AI gagal: ${message}`, 'ai_provider_error');
  }

  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  assert(text, 502, 'Penyedia AI tidak memulangkan cadangan.', 'ai_empty_response');
  return { text };
}

async function callProvider(
  env: Bindings,
  settings: AiSettingsRow | null,
  input: AiSuggestionInput
): Promise<{ result: ProviderText; provider: AiProvider; model: string }> {
  const provider = settings?.provider ?? 'cloudflare';
  const model = settings?.model || defaultModel(env, provider);

  if (provider === 'cloudflare') {
    return { result: await callCloudflare(env, model, input), provider, model };
  }

  assert(
    settings?.api_key_cipher,
    400,
    `Tetapkan kunci API ${getAiProviderInfo(provider).label} dalam Tetapan AI terlebih dahulu.`,
    'ai_key_missing'
  );

  const apiKey = await decryptApiKey(env, settings.api_key_cipher);

  if (provider === 'gemini') {
    return { result: await callGemini(apiKey, model, input), provider, model };
  }

  return {
    result: await callOpenAiCompatible(provider, apiKey, model, settings.base_url, input),
    provider,
    model
  };
}

function localSuggestion(input: AiSuggestionInput): { text: string; hierarchy: AiHierarchy } {
  const hazard = `${input.hazard} ${input.workActivity}`.toLowerCase();
  const score = input.likelihood * input.severity;
  const level = riskLevelFromScore(score);

  const engineering: string[] = [];
  const administrative: string[] = [];
  const ppe: string[] = [];
  let elimination = '';
  let substitution = '';

  if (/elektrik|voltan|renjatan|wayar|short|spark|kimpal/.test(hazard)) {
    engineering.push('Pasang ELCB/RCD 30mA dan pastikan pembumian mesin sempurna.');
    engineering.push('Gunakan penutup bertebat serta kabel bertaraf industri.');
    administrative.push('Wajibkan Lockout/Tagout (LOTO) sebelum servis elektrik.');
    administrative.push('Pemeriksaan elektrik berkala oleh juruteknik berdaftar.');
    ppe.push('Kasut keselamatan dielektrik dan sarung tangan penebat getah.');
  } else if (/larik|milling|canai|gerudi|mesin|spindel|chuck|mata alat|tatal|putar|entangle/.test(hazard)) {
    engineering.push('Pasang pengadang interlock lutsinar pada spindel/chuck dan butang henti kecemasan.');
    engineering.push('Sediakan dulang tatal dan alat penyingkir tatal bertangkai panjang.');
    administrative.push('SOP melarang sarung tangan longgar berhampiran bahagian berpusing.');
    administrative.push('Matikan mesin sebelum menukar benda kerja atau membersihkan tatal.');
    ppe.push('Gogal keselamatan EN 166 dan apron bengkel tahan carik.');
  } else if (/kimia|asap|habuk|debu|gas|asid|coolant|pelarut|sds|weld|kimpalan/.test(hazard)) {
    engineering.push('Pasang Local Exhaust Ventilation (LEV) dengan penapis HEPA di zon kerja.');
    engineering.push('Sediakan pembendungan sekunder untuk tumpahan bahan kimia.');
    administrative.push('Pastikan SDS terkini, pelabelan GHS dan latihan pengendalian bahan kimia.');
    administrative.push('Ujian keberkesanan LEV tahunan oleh higienis berdaftar JKKP.');
    ppe.push('Respirator N95/FFP2 atau topeng gas, sarung tangan nitril dan apron PVC.');
  } else if (/bising|bunyi|getaran|audio/.test(hazard)) {
    engineering.push('Pasang panel akustik atau enclosure pada punca bunyi.');
    engineering.push('Servis bearing dan pelinciran untuk mengurangkan getaran.');
    administrative.push('Hadkan tempoh dedahan melebihi 82 dB(A) mengikut Peraturan Bising JKKP 2019.');
    administrative.push('Jadualkan audiometri tahunan untuk staf terdedah.');
    ppe.push('Ear muff atau ear plug dengan NRR minimum 25 dB.');
  } else if (/jatuh|tergelincir|licin|tersadung|lantai|tangga|platform/.test(hazard)) {
    engineering.push('Gunakan salutan anti-gelincir dan pita amaran pada laluan utama.');
    engineering.push('Pasang handrail dan toe-board pada platform tinggi.');
    administrative.push('Amalan 5S: bersihkan tumpahan serta-merta dan urus kabel dengan kemas.');
    ppe.push('Kasut keselamatan anti-gelincir dan topi keselamatan jika bekerja di ketinggian.');
  } else if (/panas|terbakar|api|relau|furnace|percikan/.test(hazard)) {
    engineering.push('Pasang penghadang haba dan pengudaraan pada zon relau.');
    engineering.push('Simpan bahan mudah terbakar dalam kabinet keselamatan berlabel.');
    administrative.push('Permit kerja panas dan pemeriksaan alat pemadam api bulanan.');
    ppe.push('Apron kulit, sarung tangan tahan haba dan pelindung muka.');
  } else if (/ergonomik|angkat|manual|postur|ulang|sakit belakang/.test(hazard)) {
    engineering.push('Sediakan meja boleh laras dan bantuan angkat mekanikal.');
    administrative.push('Latihan teknik angkat betul dan rehat berkala (micro-break).');
    ppe.push('Sarung tangan cengkam dan tali pinggang sokongan jika sesuai.');
  } else {
    engineering.push('Kenal pasti punca hazard dan pasang kawalan fizikal yang sesuai.');
    administrative.push('Kemas kini SOP, latihan pekerja dan pemeriksaan berkala.');
    ppe.push('Pilih PPE berdasarkan penilaian risiko dan pastikan ia dipakai dengan betul.');
  }

  if (level === 'High') {
    elimination = 'Hentikan operasi berisiko tinggi sehingga kawalan sementara dilaksanakan.';
    substitution = 'Pertimbangkan penggantian mesin/bahan dengan alternatif risiko lebih rendah.';
  } else if (level === 'Medium') {
    substitution = 'Nilai alternatif bahan atau kaedah kerja yang lebih selamat.';
  }

  const hierarchy: AiHierarchy = {
    elimination: elimination || undefined,
    substitution: substitution || undefined,
    engineering: engineering.join('\n'),
    administrative: administrative.join('\n'),
    ppe: ppe.join('\n')
  };

  const sections = [
    `HIERARKI KAWALAN RISIKO (L×S = ${score} — ${level})`,
    elimination ? `1. Penghapusan\n• ${elimination}` : '',
    substitution ? `2. Penggantian\n• ${substitution}` : '',
    `3. Kawalan Kejuruteraan\n${engineering.map((item) => `• ${item}`).join('\n')}`,
    `4. Kawalan Pentadbiran\n${administrative.map((item) => `• ${item}`).join('\n')}`,
    `5. PPE\n${ppe.map((item) => `• ${item}`).join('\n')}`
  ].filter(Boolean);

  return { text: sections.join('\n\n'), hierarchy };
}

export async function suggestControlMeasures(
  env: Bindings,
  user: SessionUser,
  input: AiSuggestionInput
): Promise<AiSuggestionResultDTO> {
  assert(can(user, 'ai:suggest'), 403, 'Anda tiada akses kepada AI.', 'forbidden');

  const settings = await getSettingsRow(env, user.userId);
  const provider = settings?.provider ?? 'cloudflare';
  const model = settings?.model || defaultModel(env, provider);

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify({ provider, model, input }))
  );
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
  const cacheKey = `ai:${provider}:${model}:${hash}`;

  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) {
    return { ...(cached as AiSuggestionResultDTO), cached: true };
  }

  const started = Date.now();
  let warning: string | undefined;
  let result: ProviderText;
  let source: AiSuggestionResultDTO['source'];

  try {
    const call = await callProvider(env, settings, input);
    result = call.result;
    source = call.provider === 'cloudflare' ? 'cloudflare_workers_ai' : call.provider;
  } catch (error) {
    if (error instanceof HttpError && [400, 401, 403].includes(error.status)) throw error;
    warning = error instanceof Error ? error.message : 'Penyedia AI tidak dapat dihubungi.';
    const local = localSuggestion(input);
    result = local;
    source = 'local_dosh_ai_engine';
  }

  const payload: AiSuggestionResultDTO = {
    success: true,
    suggestion: result.text,
    hierarchy: result.hierarchy,
    source,
    provider,
    model,
    warning
  };

  if (!warning) {
    await env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 });
  }
  console.log('AI suggestion', { provider, model, source, ms: Date.now() - started });
  return payload;
}
