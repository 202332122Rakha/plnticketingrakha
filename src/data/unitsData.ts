import type {Unit} from '../types';
/** Master units come only from PostgreSQL. These arrays are a session memory cache, not seed data. */
export const UPDL_UNITS:Unit[]=[];
export const NON_UPDL_UNITS:Unit[]=[];
export const OFFICIAL_UNITS:Unit[]=[];
export const ALL_REGISTERED_UNITS:Unit[]=[];
const emptyCorpu:Unit={unitId:'',unitCode:'',unitName:'Unit korporat belum dimuat',unitRegion:'Korporat',unitFocus:'',unitType:'CORPU',isActive:false,createdAt:'',updatedAt:''};
export const CORPU_UNIT:Unit={...emptyCorpu};
export function replaceUnitsFromDatabase(units:Unit[]){
  ALL_REGISTERED_UNITS.splice(0,ALL_REGISTERED_UNITS.length,...units);
  UPDL_UNITS.splice(0,UPDL_UNITS.length,...units.filter(unit=>unit.unitType==='UPDL'));
  NON_UPDL_UNITS.splice(0,NON_UPDL_UNITS.length,...units.filter(unit=>unit.unitType==='NON_UPDL'));
  OFFICIAL_UNITS.splice(0,OFFICIAL_UNITS.length,...units.filter(unit=>unit.unitType!=='NON_UPDL'&&unit.isActive));
  Object.assign(CORPU_UNIT,units.find(unit=>unit.unitType==='CORPU'&&unit.isActive)||emptyCorpu);
}
