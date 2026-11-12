import React, { useRef, useState } from 'react';
import { Upload, X, File, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { UploadedFile } from '../types/safety';

interface FileUploadSectionProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  files,
  onFilesChange,
  maxFiles = 8
}) => {
  const [compressing, setCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressAndEncode = (file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        // Non-image file (PDF etc.)
        if (file.size > 8 * 1024 * 1024) {
          return reject(new Error(`${file.name} melebihi had saiz 8MB.`));
        }
        const reader = new FileReader();
        reader.onload = () => {
          const resultStr = String(reader.result || '');
          resolve({
            name: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            data: resultStr.split(',')[1] || '',
            previewUrl: undefined
          });
        };
        reader.onerror = () => reject(new Error(`Gagal membaca fail ${file.name}`));
        reader.readAsDataURL(file);
        return;
      }

      // Image compression using Canvas
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          return reject(new Error('Canvas context tidak disokong.'));
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objUrl);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        const base64Data = dataUrl.split(',')[1] || '';
        resolve({
          name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
          mime: 'image/jpeg',
          size: Math.round((base64Data.length * 3) / 4),
          data: base64Data,
          previewUrl: dataUrl
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error(`Fail imej tidak sah atau rosak: ${file.name}`));
      };
      img.src = objUrl;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setErrorMsg('');
    const newFileList = Array.from(selected);

    if (files.length + newFileList.length > maxFiles) {
      setErrorMsg(`Maksimum ${maxFiles} fail sahaja dibenarkan.`);
      return;
    }

    setCompressing(true);
    try {
      const processed = await Promise.all(newFileList.map(compressAndEncode));
      onFilesChange([...files, ...processed]);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, idx) => idx !== index);
    onFilesChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block font-bold text-slate-800 text-xs">
            Lampiran Bukti Gambar / Dokumen Sokongan (Pilihan)
          </label>
          <p className="text-[11px] text-slate-500">
            Gambar kerosakan, pengadang mesin, audit persekitaran atau SDS. Dimampatkan secara automatik sebelum penghantaran.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
          {files.length} / {maxFiles} fail
        </span>
      </div>

      {/* Input Drop Area */}
      <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800">
              Pilih fail gambar (JPG, PNG) atau dokumen (PDF)
            </div>
            <div className="text-[10px] text-slate-500">
              Maksimum 8MB setiap fail · Pemampatan pintar sisi pelanggan
            </div>
          </div>
        </div>

        <label className="cursor-pointer shrink-0">
          <span className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-block">
            {compressing ? 'Memampatkan...' : '+ Pilih Fail'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            disabled={compressing || files.length >= maxFiles}
            className="hidden"
          />
        </label>
      </div>

      {errorMsg && (
        <div className="p-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Uploaded File Previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
          {files.map((f, idx) => (
            <div
              key={idx}
              className="relative group border border-slate-200 rounded-lg p-1.5 bg-white shadow-2xs flex flex-col items-center"
            >
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] shadow-sm hover:bg-red-700 transition-colors"
                title="Padam fail"
              >
                <X className="w-3 h-3" />
              </button>

              {f.previewUrl ? (
                <img
                  src={f.previewUrl}
                  alt={f.name}
                  className="w-full h-16 object-cover rounded-md mb-1 bg-slate-100"
                />
              ) : (
                <div className="w-full h-16 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 mb-1">
                  <File className="w-6 h-6" />
                </div>
              )}

              <span className="text-[10px] font-medium text-slate-700 truncate w-full text-center">
                {f.name}
              </span>
              <span className="text-[9px] text-slate-400 tabular-nums">
                {Math.round(f.size / 1024)} KB
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
