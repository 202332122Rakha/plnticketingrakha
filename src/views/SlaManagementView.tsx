import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Save,
  Info,
} from 'lucide-react';
import { SlaConfig, PriorityLevel } from '../types';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { listSlaConfigs, saveSlaConfigs } from '../services/slaApiService';

export const SlaManagementView: React.FC = () => {
  const [configs, setConfigs] = useState<SlaConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSlaConfigs()
      .then((loadedConfigs) => {
        if (!cancelled) {
          setConfigs(loadedConfigs);
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat SLA dari database.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = (priority: PriorityLevel, field: 'responseMinutes' | 'resolveHours' | 'description', value: any) => {
    setConfigs((prev) =>
      prev.map((c) => (c.priority === priority ? { ...c, [field]: value } : c))
    );
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveSlaConfigs(configs);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi SLA.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Konfigurasi SLA dan Matriks Prioritas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Atur target waktu respons pertama (First Response Time) dan waktu penyelesaian akhir (Resolution Time).
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading || isSaving || configs.length === 0}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan SLA'}</span>
        </button>
      </div>

      {errorMessage && <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">{errorMessage}</div>}
      {isLoading && <div className="py-10 text-center text-xs text-slate-500">Memuat konfigurasi SLA...</div>}

      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Konfigurasi Service Level Agreement (SLA) berhasil disimpan ke sistem!
        </div>
      )}

      {/* Info Card */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-800">Kalender Kerja Operasional:</span> Waktu SLA dihitung
          berdasarkan jam kerja operasional PLN Corporate University (Senin - Jumat, 07:30 - 17:00 WIB). Laporan
          prioritas <span className="font-semibold text-rose-700">Kritis</span> tetap diberlakukan eskalasi darurat 24/7.
        </div>
      </div>

      {/* SLA Cards Grid */}
      {!isLoading && configs.length > 0 && <div className="space-y-4">
        {configs.map((cfg) => (
          <div
            key={cfg.priority}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 hover:border-slate-300 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <PriorityBadge priority={cfg.priority} size="lg" />
                <span className="text-xs text-slate-500 font-medium">Tingkat Prioritas</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Target Respons Pertama (Menit)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    value={cfg.responseMinutes}
                    onChange={(e) =>
                      handleUpdate(cfg.priority, 'responseMinutes', Number(e.target.value))
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    Menit
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Batas waktu petugas PIC harus memberikan tanggapan awal
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Target Resolusi Tuntas (Jam)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={cfg.resolveHours}
                    onChange={(e) =>
                      handleUpdate(cfg.priority, 'resolveHours', Number(e.target.value))
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    Jam Kerja
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Batas waktu tiket harus diselesaikan dan solusi diterapkan
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Kriteria & Definisi Dampak Operasional
              </label>
              <textarea
                rows={2}
                value={cfg.description}
                onChange={(e) => handleUpdate(cfg.priority, 'description', e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
};
