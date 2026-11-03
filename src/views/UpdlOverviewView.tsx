import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight,
  Inbox,
  Filter,
} from 'lucide-react';
import { User as UserType } from '../types';
import { UPDL_UNITS } from '../data/unitsData';
import { storageService } from '../services/storageService';

interface UpdlOverviewViewProps {
  currentUser: UserType;
  onNavigate: (view: string, unitId?: string) => void;
}

export const UpdlOverviewView: React.FC<UpdlOverviewViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<'ALL' | 'Jawa' | 'Luar Jawa'>('ALL');

  // Live active counts from storageService
  const activeCounts = useMemo(() => {
    return storageService.getAllUpdlUnitActiveCounts();
  }, []);

  const tickets = useMemo(() => {
    return storageService.getTickets();
  }, []);

  // Filter 11 UPDL units by search and region
  const filteredUnits = useMemo(() => {
    return UPDL_UNITS.filter((unit) => {
      if (selectedRegion !== 'ALL' && unit.unitRegion !== selectedRegion) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = unit.unitName.toLowerCase().includes(q);
        const mCode = unit.unitCode.toLowerCase().includes(q);
        const mFocus = unit.unitFocus.toLowerCase().includes(q);
        if (!mName && !mCode && !mFocus) return false;
      }
      return true;
    });
  }, [searchQuery, selectedRegion]);

  const jawaUnits = filteredUnits.filter((u) => u.unitRegion === 'Jawa');
  const luarJawaUnits = filteredUnits.filter((u) => u.unitRegion === 'Luar Jawa');

  // Overall totals across all 11 UPDL
  const totalUpdlTickets = useMemo(() => {
    return tickets.filter((t) => t.reporterUnitType === 'UPDL').length;
  }, [tickets]);

  const activeUpdlTickets = useMemo(() => {
    return tickets.filter(
      (t) => t.reporterUnitType === 'UPDL' && !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;
  }, [tickets]);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-[#69777D]">
        <button
          onClick={() => onNavigate('dashboard')}
          className="hover:text-[#417F85] transition-colors cursor-pointer"
        >
          Dashboard
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-[#69777D]/60" />
        <span className="font-bold text-[#20272B]">Tiket Unit UPDL</span>
      </nav>

      {/* Header Banner */}
      <div className="bg-[#F5FAFA] p-6 rounded-2xl border border-[#D5E0E3] shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#417F85] text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-[#20272B] tracking-tight">
              Manajemen Tiket Unit UPDL
            </h1>
          </div>
          <p className="text-xs text-[#69777D] leading-relaxed pl-11.5">
            Pusat pemantauan dan pengelolaan tiket khusus dari 11 unit UPDL PT PLN (Persero). Setiap unit memiliki halaman terisolasi dengan data, statistik, dan hak akses yang terjamin.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-[#D5E0E3] shadow-2xs shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#69777D] block">
              Total Tiket 11 UPDL
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-[#20272B] font-mono-numbers">
                {totalUpdlTickets}
              </span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {activeUpdlTickets} Aktif
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Region Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#D5E0E3] shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#69777D] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama unit, kode, atau fokus akademi..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-[#F5FAFA] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D]"
          />
        </div>

        <div className="flex items-center gap-2">
          {(['ALL', 'Jawa', 'Luar Jawa'] as const).map((reg) => (
            <button
              key={reg}
              onClick={() => setSelectedRegion(reg)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRegion === reg
                  ? 'bg-[#417F85] text-white shadow-2xs'
                  : 'bg-[#F5FAFA] text-[#69777D] hover:bg-[#E7EFF1] hover:text-[#20272B] border border-[#D5E0E3]'
              }`}
            >
              {reg === 'ALL' ? 'Semua Wilayah (11 UPDL)' : `Wilayah ${reg}`}
            </button>
          ))}
        </div>
      </div>

      {/* Section A: Wilayah Pulau Jawa (6 UPDL) */}
      {(selectedRegion === 'ALL' || selectedRegion === 'Jawa') && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#417F85]" />
            <h2 className="text-sm font-extrabold text-[#20272B] tracking-tight uppercase">
              Wilayah Pulau Jawa (6 UPDL)
            </h2>
            <span className="text-xs text-[#69777D] font-mono">
              ({jawaUnits.length} Unit)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {jawaUnits.map((u) => {
              const activeCount = activeCounts[u.unitId] || 0;
              const isUserUnit = currentUser.unitId === u.unitId;

              return (
                <div
                  key={u.unitId}
                  onClick={() => onNavigate('unit-tickets', u.unitId)}
                  className="bg-white p-4 rounded-xl border border-[#D5E0E3] hover:border-[#417F85] hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-[#E7EFF1] text-[#417F85] flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#417F85] group-hover:text-white transition-colors">
                          <Building2 className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="font-extrabold text-xs text-[#20272B] group-hover:text-[#417F85] transition-colors">
                            {u.unitName}
                          </h3>
                          <span className="text-[10px] font-mono font-bold text-[#69777D]">
                            {u.unitCode}
                          </span>
                        </div>
                      </div>

                      {/* Active Tickets Count Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono shrink-0 ${
                          activeCount > 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {activeCount} Aktif
                      </span>
                    </div>

                    <p className="text-[11px] text-[#69777D] line-clamp-2 leading-relaxed">
                      {u.unitFocus}
                    </p>

                    {isUserUnit && (
                      <span className="inline-block text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold">
                        ★ Unit Asal Anda
                      </span>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#D5E0E3] flex items-center justify-between text-xs text-[#417F85] font-bold group-hover:text-[#326A70]">
                    <span>Buka Halaman Tiket</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section B: Wilayah Luar Pulau Jawa (5 UPDL) */}
      {(selectedRegion === 'ALL' || selectedRegion === 'Luar Jawa') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#35666D]" />
            <h2 className="text-sm font-extrabold text-[#20272B] tracking-tight uppercase">
              Wilayah Luar Pulau Jawa (5 UPDL)
            </h2>
            <span className="text-xs text-[#69777D] font-mono">
              ({luarJawaUnits.length} Unit)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {luarJawaUnits.map((u) => {
              const activeCount = activeCounts[u.unitId] || 0;
              const isUserUnit = currentUser.unitId === u.unitId;

              return (
                <div
                  key={u.unitId}
                  onClick={() => onNavigate('unit-tickets', u.unitId)}
                  className="bg-white p-4 rounded-xl border border-[#D5E0E3] hover:border-[#417F85] hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-[#E7EFF1] text-[#417F85] flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#417F85] group-hover:text-white transition-colors">
                          <Building2 className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="font-extrabold text-xs text-[#20272B] group-hover:text-[#417F85] transition-colors">
                            {u.unitName}
                          </h3>
                          <span className="text-[10px] font-mono font-bold text-[#69777D]">
                            {u.unitCode}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono shrink-0 ${
                          activeCount > 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {activeCount} Aktif
                      </span>
                    </div>

                    <p className="text-[11px] text-[#69777D] line-clamp-2 leading-relaxed">
                      {u.unitFocus}
                    </p>

                    {isUserUnit && (
                      <span className="inline-block text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold">
                        ★ Unit Asal Anda
                      </span>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#D5E0E3] flex items-center justify-between text-xs text-[#417F85] font-bold group-hover:text-[#326A70]">
                    <span>Buka Halaman Tiket</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
