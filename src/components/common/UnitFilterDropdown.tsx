import React from 'react';
import { Building2 } from 'lucide-react';
import { Unit } from '../../types';

interface UnitFilterDropdownProps {
  selectedUnitId: string;
  onChange: (unitId: string) => void;
  units: Unit[];
  allowAll?: boolean;
  asalUnitFilter?: 'ALL' | 'UPDL' | 'CORPU' | 'NON_UPDL';
  className?: string;
  labelPrefix?: string;
}

/**
 * Filter Unit Dropdown (11 UPDL, PLN Corpu, dan Unit Umum/Non-UPDL)
 * Mendukung pembatasan opsi sesuai Asal Unit terpilih.
 */
export const UnitFilterDropdown: React.FC<UnitFilterDropdownProps> = ({
  selectedUnitId,
  onChange,
  units,
  allowAll = true,
  asalUnitFilter = 'ALL',
  className = '',
  labelPrefix = '',
}) => {
  const filteredUnits = units.filter((u) => {
    if (asalUnitFilter === 'UPDL') return u.unitType === 'UPDL';
    if (asalUnitFilter === 'CORPU') return u.unitType === 'CORPU';
    if (asalUnitFilter === 'NON_UPDL') return u.unitType === 'NON_UPDL';
    return true;
  });

  const jawaUnits = filteredUnits.filter((u) => u.unitRegion === 'Jawa' && u.unitType === 'UPDL');
  const luarJawaUnits = filteredUnits.filter((u) => u.unitRegion === 'Luar Jawa' && u.unitType === 'UPDL');
  const corpuUnits = filteredUnits.filter((u) => u.unitType === 'CORPU');
  const nonUpdlUnits = filteredUnits.filter((u) => u.unitType === 'NON_UPDL');

  const allLabel =
    asalUnitFilter === 'UPDL'
      ? `${labelPrefix}Semua 11 Unit UPDL`
      : asalUnitFilter === 'CORPU'
      ? `${labelPrefix}PLN Corporate University`
      : asalUnitFilter === 'NON_UPDL'
      ? `${labelPrefix}Semua Unit Umum / Non-UPDL`
      : `${labelPrefix}Semua Unit`;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <div className="relative flex items-center w-full">
        <Building2 className="w-3.5 h-3.5 text-[#417F85] absolute left-2.5 pointer-events-none shrink-0" />
        <select
          value={selectedUnitId}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pilih Filter Unit"
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#FFFFFF] border border-[#D5E0E3] hover:border-[#417F85] focus:border-[#417F85] focus:ring-2 focus:ring-[#417F85]/20 rounded-lg text-[#20272B] font-medium shadow-2xs transition-all cursor-pointer truncate appearance-none"
        >
          {allowAll && <option value="ALL">{allLabel}</option>}

          {jawaUnits.length > 0 && (
            <optgroup label="Wilayah Pulau Jawa (6 UPDL)">
              {jawaUnits.map((unit) => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.unitName}
                </option>
              ))}
            </optgroup>
          )}

          {luarJawaUnits.length > 0 && (
            <optgroup label="Wilayah Luar Pulau Jawa (5 UPDL)">
              {luarJawaUnits.map((unit) => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.unitName}
                </option>
              ))}
            </optgroup>
          )}

          {corpuUnits.length > 0 && (
            <optgroup label="Unit Korporat (Bukan UPDL)">
              {corpuUnits.map((unit) => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.unitName}
                </option>
              ))}
            </optgroup>
          )}

          {nonUpdlUnits.length > 0 && (
            <optgroup label="Unit Umum / Non-UPDL Terdaftar">
              {nonUpdlUnits.map((unit) => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.unitName}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="absolute right-2 pointer-events-none text-[#64748B] text-[10px]">
          ▼
        </div>
      </div>
    </div>
  );
};
