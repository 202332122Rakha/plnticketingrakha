import React, {useEffect, useState} from 'react';
import {Database, Download, RefreshCw, ShieldCheck, AlertTriangle} from 'lucide-react';
import {storageService} from '../services/storageService';
import {getDatabaseHealth} from '../services/adminApiService';
export const SettingsView:React.FC=()=>{
  const [status,setStatus]=useState<'checking'|'connected'|'disconnected'>('checking');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const check=async()=>{setStatus('checking');try{const health=await getDatabaseHealth();setStatus(health.ok?'connected':'disconnected');setMessage(health.message||'');}catch{setStatus('disconnected');setMessage('API belum dapat dijangkau. Periksa server dan jaringan.');}};
  useEffect(()=>{void check();},[]);
  const refresh=async()=>{setBusy(true);try{await check();await storageService.refresh();setMessage('Data dimuat ulang dari PostgreSQL. Tidak ada data yang dihapus.');}catch(error){setMessage(error instanceof Error?error.message:'Pemuatan ulang gagal.');}finally{setBusy(false);}};
  const exportReport=async()=>{setBusy(true);try{const json=await storageService.exportAllData();const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`Laporan_Ticketing_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Ekspor laporan selesai. Simpan sesuai ketentuan perlindungan data perusahaan.');}catch(error){setMessage(error instanceof Error?error.message:'Ekspor gagal.');}finally{setBusy(false);}};
  return <div className="max-w-4xl mx-auto space-y-6">
    <section className="bg-white p-6 rounded-xl border border-slate-200">
      <h1 className="text-xl font-extrabold text-slate-900">Pengaturan Aplikasi</h1>
      <p className="text-sm text-slate-500 mt-2">PLN Corporate University Ticketing - PostgreSQL</p>
    </section>
    <section className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
      <h2 className="font-bold flex items-center gap-2"><Database size={20}/>Status koneksi database</h2>
      <p className={status==='connected'?'text-emerald-700 font-semibold':'text-amber-700 font-semibold'}>{status==='checking'?'Memeriksa koneksi...':status==='connected'?'PostgreSQL terhubung':'Database belum terhubung'}</p>
      <p className="text-sm text-slate-600" role="status">{message}</p>
      <p className="text-sm text-slate-500">Data operasional disimpan melalui backend/API. Browser hanya menyimpan salinan sementara di memori, bukan database lokal.</p>
      <button disabled={busy} onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg disabled:opacity-50"><RefreshCw size={16}/>Muat ulang dari server</button>
    </section>
    <section className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
      <h2 className="font-bold flex items-center gap-2"><ShieldCheck size={20}/>Ekspor dan pencadangan</h2>
      <p className="text-sm text-slate-600">Ekspor JSON berisi laporan data operasional tanpa hash password dan tanpa isi lampiran. File ini mengandung data pengguna/tiket; batasi distribusinya.</p>
      <button disabled={busy} onClick={exportReport} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg disabled:opacity-50"><Download size={16}/>Ekspor laporan JSON</button>
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm flex gap-3"><AlertTriangle size={22} className="shrink-0"/><p>Ekspor laporan bukan backup untuk pemulihan database. Administrator server perlu menggunakan pg_dump, menyimpan backup secara aman, dan menguji pemulihannya. Tidak tersedia tombol reset/hapus database pada aplikasi.</p></div>
    </section>
  </div>;
};
