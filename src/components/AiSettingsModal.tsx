import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Server,
  Sparkles
} from 'lucide-react';
import {
  AI_PROVIDER_CATALOG,
  getAiProviderInfo,
  type AiProvider,
  type AiSettingsDTO
} from '../../shared/ai';
import { getAiSettings, saveAiSettings } from '../services/portalApi';
import { Modal } from './ui/Modal';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: AiSettingsDTO) => void;
}

const PROVIDER_ICONS: Record<AiProvider, React.ReactNode> = {
  cloudflare: <Cloud className="w-4 h-4" />,
  gemini: <Sparkles className="w-4 h-4" />,
  deepseek: <Server className="w-4 h-4" />,
  openai_compatible: <Server className="w-4 h-4" />
};

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [settings, setSettings] = useState<AiSettingsDTO | null>(null);
  const [provider, setProvider] = useState<AiProvider>('cloudflare');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setIsLoading(true);
    setError('');
    setSuccess('');
    setApiKey('');
    setClearApiKey(false);

    getAiSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        setProvider(loaded.provider);
        setModel(loaded.model);
        setBaseUrl(loaded.baseUrl);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Gagal memuatkan tetapan AI.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const info = useMemo(() => getAiProviderInfo(provider), [provider]);
  const isByok = info.requiresApiKey;

  const handleProviderChange = (next: AiProvider) => {
    const nextInfo = getAiProviderInfo(next);
    setProvider(next);
    setModel(nextInfo.defaultModel);
    setBaseUrl(next === 'openai_compatible' ? baseUrl : '');
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const saved = await saveAiSettings({
        provider,
        model: model.trim() || info.defaultModel,
        baseUrl: provider === 'openai_compatible' ? baseUrl.trim() : '',
        apiKey: apiKey.trim() || undefined,
        clearApiKey
      });
      setSettings(saved);
      setProvider(saved.provider);
      setModel(saved.model);
      setBaseUrl(saved.baseUrl);
      setApiKey('');
      setClearApiKey(false);
      setSuccess('Tetapan AI disimpan. Permintaan seterusnya akan menggunakan penyedia ini.');
      onSaved?.(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan tetapan AI.');
    } finally {
      setIsSaving(false);
    }
  };

  const keyState = settings?.hasApiKey
    ? `Kunci tersimpan ${settings.apiKeyHint ?? ''}`
    : 'Tiada kunci API tersimpan';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tetapan AI"
      subtitle="Lalai: Cloudflare Workers AI · Pilihan BYOK: Gemini, DeepSeek, OpenAI-compatible"
      icon={<Sparkles className="w-5 h-5" />}
      maxWidthClassName="max-w-2xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Kunci BYOK disulitkan AES-GCM di pelayan dan tidak dipaparkan semula.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Tetapan'}</span>
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-10 flex items-center justify-center text-slate-500 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuatkan tetapan...
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AI_PROVIDER_CATALOG.map((candidate) => {
              const active = candidate.id === provider;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleProviderChange(candidate.id)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    active
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {PROVIDER_ICONS[candidate.id]}
                    </span>
                    <span className="truncate">{candidate.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    {candidate.description}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold">
                    {candidate.requiresApiKey ? (
                      <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        BYOK
                      </span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        Lalai
                      </span>
                    )}
                    <span className="text-slate-500 truncate">{candidate.defaultModel}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/60">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                list="ai-model-suggestions"
                placeholder={info.defaultModel}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
              <datalist id="ai-model-suggestions">
                {info.suggestedModels.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
              <p className="text-[10px] text-slate-500 mt-1">
                Kosongkan untuk guna model lalai: <span className="font-mono">{info.defaultModel}</span>
              </p>
            </div>

            {provider === 'openai_compatible' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">URL Asas</label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Endpoint <span className="font-mono">/chat/completions</span> akan ditambah secara automatik.
                </p>
              </div>
            )}

            {isByok && (
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Kunci API {info.label}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={settings?.hasApiKey ? `${keyState} — biarkan kosong untuk kekalkan` : 'Masukkan kunci API'}
                    autoComplete="off"
                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className={settings?.hasApiKey ? 'text-emerald-800 font-semibold' : 'text-slate-500'}>
                    {keyState}
                  </span>
                  {settings?.hasApiKey && (
                    <label className="flex items-center gap-1.5 text-slate-600">
                      <input
                        type="checkbox"
                        checked={clearApiKey}
                        onChange={(event) => setClearApiKey(event.target.checked)}
                      />
                      Padam kunci tersimpan
                    </label>
                  )}
                </div>
                {settings && !settings.encryptionReady && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                    <span className="font-bold">Penyulitan belum sedia.</span> Pentadbir perlu menetapkan
                    rahsia <code className="font-mono">AI_KEY_ENCRYPTION_SECRET</code> pada Worker sebelum
                    kunci BYOK boleh disimpan.
                  </div>
                )}
              </div>
            )}

            {!isByok && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                <span className="font-bold">Tiada kunci API diperlukan.</span> Permintaan dihantar ke
                binding Workers AI dalam akaun Cloudflare yang sama, dengan cache KV 24 jam.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-3 text-[11px] text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800">Nota keselamatan:</span> kunci API disimpan
            dalam D1 sebagai ciphertext AES-GCM. Kunci tidak pernah dihantar semula ke pelayar selepas
            disimpan. Jika penyedia BYOK gagal, portal akan memaparkan amaran dan menggunakan enjin
            cadangan DOSH/JKKP setempat.
          </div>
        </div>
      )}
    </Modal>
  );
};
