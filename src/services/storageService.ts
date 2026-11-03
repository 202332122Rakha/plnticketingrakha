/** Read-only in-memory snapshot of API responses. PostgreSQL is the only durable business store. */
import type {ActivityLog, AdminAuditLog, AutoAssignmentRule, Category, RegistrationRequest, Role, Ticket, Unit, UnitType, User} from '../types';
import * as api from './adminApiService';
import {listCategories,listTickets} from './ticketApiService';
import {listRegistrationRequests,approveRegistration,rejectRegistration} from './registrationApiService';
import {replaceUnitsFromDatabase} from '../data/unitsData';
import {registerDynamicUnits} from '../utils/unitHelpers';
import {apiFetch,readApiResponse} from './http';
const active=(ticket:Ticket)=>!['Selesai','Ditutup','Ditolak'].includes(ticket.status);
const message=(error:unknown)=>error instanceof Error?error.message:'Permintaan ke server gagal.';
class DatabaseSnapshot {
  private user:User|null=null;
  private users:User[]=[];
  private units:Unit[]=[];
  private tickets:Ticket[]=[];
  private categories:Category[]=[];
  private rules:AutoAssignmentRule[]=[];
  private registrations:RegistrationRequest[]=[];
  private logs:ActivityLog[]=[];
  private listeners=new Set<()=>void>();
  private generation=0;
  subscribe(listener:()=>void) {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  private notify(){this.listeners.forEach(listener=>listener());}
  private resetRows(){this.users=[];this.units=[];this.tickets=[];this.categories=[];this.rules=[];this.registrations=[];this.logs=[];replaceUnitsFromDatabase([]);registerDynamicUnits([]);}
  clear(){this.generation++;this.user=null;this.resetRows();this.notify();}
  async refresh(user:User|null=this.user):Promise<void> {
    const generation=++this.generation;this.user=user;
    if(!user){this.resetRows();this.notify();return;}
    const admin=user.role==='admin';
    try {
      const [units,tickets,categories,users,registrations,rules,logs]=await Promise.all([
        api.listUnits(admin),listTickets(),admin?api.listAdminCategories():listCategories(),
        admin?api.listAdminUsers():Promise.resolve([user]),
        admin?listRegistrationRequests():Promise.resolve([]),
        admin?api.listAssignmentRules():Promise.resolve([]),admin?api.listAuditLogs():Promise.resolve([]),
      ]);
      if(generation!==this.generation) return;
      this.units=units;this.tickets=tickets;this.categories=categories;this.users=users;this.registrations=registrations;this.rules=rules;this.logs=logs;
      replaceUnitsFromDatabase(units);registerDynamicUnits(units);this.notify();
    } catch(error) {if(generation===this.generation){this.resetRows();this.notify();}throw error;}
  }
  private async reloadAfterWrite(){try{await this.refresh();}catch(error){throw new Error(`Perubahan sudah diterima server, tetapi pemuatan ulang gagal: ${message(error)} Muat ulang halaman; jangan langsung mengulangi pembuatan data.`);}}
  getUnits(){return [...this.units];} getUsers(){return [...this.users];} getTickets(){return [...this.tickets];}
  getCategories(){return [...this.categories];} getAssignmentRules(){return [...this.rules];}
  getRegistrationRequests(){return [...this.registrations];} getActivityLogs(){return [...this.logs];}
  getAdminAuditLogs():AdminAuditLog[]{return this.logs.map(log=>({id:log.id,actorId:log.actorId,actorName:log.actorName,actorRole:log.actorRole,action:log.action as AdminAuditLog['action'],targetUserId:log.ticketId,targetUserName:log.ticketNumber,details:log.details||'',createdAt:log.createdAt}));}
  getActiveTicketsForPic(uid:string){return this.tickets.filter(ticket=>ticket.currentPicId===uid&&active(ticket));}
  getAllUpdlUnitActiveCounts(){return Object.fromEntries(this.units.filter(unit=>unit.unitType==='UPDL').map(unit=>[unit.unitId,this.tickets.filter(ticket=>(ticket.handlingUnitId||ticket.reporterUnitId)===unit.unitId&&active(ticket)).length]));}
  getUpdlActiveCount(user?:User){if(!user)return 0;const ids=new Set(this.units.filter(unit=>unit.unitType==='UPDL').map(unit=>unit.unitId));return this.tickets.filter(ticket=>ids.has(ticket.handlingUnitId||ticket.reporterUnitId||'')&&active(ticket)).length;}
  async saveUser(user:User,password?:string):Promise<User>{
    const existing=this.users.some(item=>item.uid===user.uid);
    const input={...user,username:user.username||user.employeeId,name:user.name,unitId:user.unitId||''};
    const saved=existing?await api.updateAdminUser(user.uid,input):await api.createAdminUser({...input,password:password||''});
    await this.reloadAfterWrite();return saved;
  }
  async saveUnit(unit:Unit,_actor?:User){const saved=await api.updateUnit(unit.unitId,unit);await this.reloadAfterWrite();return saved;}
  async addUnit(data:{unitCode:string;unitName:string;unitType:UnitType;unitRegion?:string;unitFocus?:string;isActive?:boolean},_actor?:User){
    try{const unit=await api.createUnit({...data,unitRegion:data.unitRegion||'Non-UPDL',unitFocus:data.unitFocus||''});await this.reloadAfterWrite();return {success:true,unit};}catch(error){return {success:false,error:message(error)};}
  }
  async toggleUnitActive(id:string,_actor?:User){try{const unit=await api.toggleUnitActive(id);await this.reloadAfterWrite();return {success:true,unit};}catch(error){return {success:false,error:message(error)};}}
  async deleteUnit(id:string,_actor?:User){try{await api.deleteUnit(id);await this.reloadAfterWrite();return {success:true};}catch(error){return {success:false,error:message(error)};}}
  canDeleteUnit(id:string){const userCount=this.users.filter(user=>user.unitId===id).length;const ticketCount=this.tickets.filter(ticket=>ticket.reporterUnitId===id||ticket.handlingUnitId===id).length;return {canDelete:userCount+ticketCount===0,userCount,ticketCount,reason:userCount+ticketCount?'Unit masih direferensikan pengguna/tiket.':undefined};}
  async saveCategory(category:Category){const existing=this.categories.some(item=>item.id===category.id);const saved=await api.saveAdminCategory(category,existing);await this.reloadAfterWrite();return saved;}
  async deleteCategory(id:string){await api.deleteAdminCategory(id);await this.reloadAfterWrite();}
  async saveAssignmentRule(rule:AutoAssignmentRule){await api.saveAssignmentRule(rule);await this.reloadAfterWrite();}
  async classifyTicketUnit(id:string,unitKey:string,_actor:User){await api.classifyTicketUnit(id,unitKey);await this.reloadAfterWrite();return this.tickets.find(ticket=>ticket.id===id);}
  async reassignActiveTickets(from:string,to:string,_actor:User,reason='Pengalihan penugasan oleh Administrator'){
    const numbers=this.getActiveTicketsForPic(from).map(ticket=>ticket.ticketNumber);await api.reassignPicTickets(from,to,reason);await this.reloadAfterWrite();return {count:numbers.length,reassignedTicketNumbers:numbers};
  }
  async approveRegistrationRequest(id:string,role:Role,_actor:User,unitId?:string){
    try{const request=this.registrations.find(item=>item.id===id);if(!request)throw new Error('Permohonan tidak ditemukan. Muat ulang data.');await approveRegistration(request,role,unitId||request.unitId);await this.reloadAfterWrite();return {success:true,user:this.users.find(user=>user.employeeId===request.employeeId)};}catch(error){return {success:false,error:message(error)};}
  }
  async rejectRegistrationRequest(id:string,reason:string,_actor:User){try{await rejectRegistration(id,reason);await this.reloadAfterWrite();return {success:true};}catch(error){return {success:false,error:message(error)};}}
  validateRoleChange(target:User,role:Role,actor:User){
    if(target.uid===actor.uid&&target.role!==role)return {valid:false,message:'Tidak boleh menurunkan peran akun sendiri.'};
    if(target.role==='admin'&&role!=='admin'&&!this.users.some(user=>user.uid!==target.uid&&user.role==='admin'&&user.isActive))return {valid:false,message:'Minimal satu Admin aktif harus tersedia.'};
    return {valid:true};
  }
  validateStatusChange(target:User,status:boolean,actor:User){
    if(!status&&target.uid===actor.uid)return {valid:false,message:'Tidak boleh menonaktifkan akun sendiri.'};
    if(!status&&target.role==='admin'&&!this.users.some(user=>user.uid!==target.uid&&user.role==='admin'&&user.isActive))return {valid:false,message:'Minimal satu Admin aktif harus tersedia.'};
    return {valid:true};
  }
  async exportAllData(){const response=await apiFetch('/api/admin/export');const body=await readApiResponse(response);return JSON.stringify(body.data,null,2);}
}
export const storageService=new DatabaseSnapshot();
