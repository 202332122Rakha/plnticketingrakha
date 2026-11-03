import { HxmsComponent } from '../types';

/**
 * MASTER DATA STRUKTUR KOMPONEN & SUBKATEGORI HXMS
 * Sistem Pembelajaran (HXMS)
 * Kategori -> Komponen -> Subkategori -> Tim/PIC -> SLA
 */
export const HXMS_COMPONENTS: HxmsComponent[] = [
  {
    id: 'comp-hxms-acc',
    code: 'HXMS_ACC',
    name: 'Akun dan Hak Akses',
    description: 'Kendala autentikasi akun pembelajar, hak akses kelas, dan aktivasi pengguna HXMS.',
    subcategories: [
      'Akun tidak dapat login',
      'Aktivasi akun',
      'Hak akses tidak sesuai',
    ],
  },
  {
    id: 'comp-hxms-mod',
    code: 'HXMS_MOD',
    name: 'Modul Pembelajaran',
    description: 'Kendala pembukaan modul, pemuatan halaman silabus diklat, dan sinkronisasi progres.',
    subcategories: [
      'Modul tidak dapat dibuka',
      'Modul tidak tampil',
      'Progres pembelajaran tidak tersimpan',
    ],
  },
  {
    id: 'comp-hxms-exm',
    code: 'HXMS_EXM',
    name: 'Ujian dan Kuis',
    description: 'Kendala pelaksanaan tes daring, lembar ujian terputus, dan publikasi nilai kelulusan.',
    subcategories: [
      'Ujian daring bermasalah',
      'Hasil ujian tidak muncul',
      'Kuis tidak dapat dikirim',
    ],
  },
  {
    id: 'comp-hxms-mat',
    code: 'HXMS_MAT',
    name: 'Materi Pembelajaran',
    description: 'Kendala akses streaming video interaktif, pengunduhan e-book, dan dokumen materi diklat.',
    subcategories: [
      'Video tidak dapat diputar',
      'Materi tidak dapat diunduh',
      'Dokumen tidak tampil',
    ],
  },
  {
    id: 'comp-hxms-cls',
    code: 'HXMS_CLS',
    name: 'Kelas dan Peserta',
    description: 'Kendala sinkronisasi daftar peserta diklat UPDL, enroll kelas pelatihan, dan jadwal sesi.',
    subcategories: [
      'Peserta tidak muncul di kelas',
      'Peserta tidak dapat mengakses kelas',
      'Jadwal pembelajaran tidak sesuai',
    ],
  },
  {
    id: 'comp-hxms-tec',
    code: 'HXMS_TEC',
    name: 'Gangguan Teknis',
    description: 'Galat error server, halaman crash, dan unresponsiveness sistem HXMS.',
    subcategories: [
      'Error aplikasi',
      'Halaman gagal dimuat',
      'Sistem tidak merespons',
    ],
  },
];
