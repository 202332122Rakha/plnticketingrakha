// Initial master data only. No user accounts or sample tickets.
export const units = [
  { key: 'unit-updl-jkt', code: 'UPDL_JKT', name: 'PLN UPDL Jakarta', type: 'UPDL', region: 'Jawa', focus: 'Leadership Academy dan Corporate Culture Academy.' },
  { key: 'unit-updl-bgr', code: 'UPDL_BGR', name: 'PLN UPDL Bogor', type: 'UPDL', region: 'Jawa', focus: 'Project Academy dan Procurement Academy.' },
  { key: 'unit-updl-srl', code: 'UPDL_SRL', name: 'PLN UPDL Suralaya', type: 'UPDL', region: 'Jawa', focus: 'Primary Energy dan Power Generation Academy.' },
  { key: 'unit-updl-smg', code: 'UPDL_SMG', name: 'PLN UPDL Semarang', type: 'UPDL', region: 'Jawa', focus: 'Transmission dan Live Line Maintenance Academy.' },
  { key: 'unit-updl-pdn', code: 'UPDL_PDN', name: 'PLN UPDL Pandaan', type: 'UPDL', region: 'Jawa', focus: 'Distribution dan Commerce Academy.' },
  { key: 'unit-updl-sby', code: 'UPDL_SBY', name: 'PLN UPDL Surabaya', type: 'UPDL', region: 'Jawa', focus: 'Pelatihan teknis kelistrikan wilayah Surabaya.' },
  { key: 'unit-updl-ttg', code: 'UPDL_TTG', name: 'PLN UPDL Tuntungan', type: 'UPDL', region: 'Luar Jawa', focus: 'Pembelajaran ketenagalistrikan wilayah Sumatera Bagian Utara.' },
  { key: 'unit-updl-pdg', code: 'UPDL_PDG', name: 'PLN UPDL Padang', type: 'UPDL', region: 'Luar Jawa', focus: 'Pendidikan dan pelatihan kelistrikan Sumatera Barat.' },
  { key: 'unit-updl-plb', code: 'UPDL_PLB', name: 'PLN UPDL Palembang', type: 'UPDL', region: 'Luar Jawa', focus: 'Ketenagalistrikan wilayah Sumatera Bagian Selatan.' },
  { key: 'unit-updl-bjb', code: 'UPDL_BJB', name: 'PLN UPDL Banjarbaru', type: 'UPDL', region: 'Luar Jawa', focus: 'Pengembangan kompetensi kelistrikan wilayah Kalimantan.' },
  { key: 'unit-updl-mks', code: 'UPDL_MKS', name: 'PLN UPDL Makassar', type: 'UPDL', region: 'Luar Jawa', focus: 'Pendidikan teknik kelistrikan wilayah Sulawesi, Maluku, dan Papua.' },
  { key: 'unit-pln-corpu', code: 'PLN_CORPU', name: 'PLN Corporate University (PLN Corpu)', type: 'CORPU', region: 'Korporat', focus: 'Pengelolaan pembelajaran korporat dan layanan HXMS.' },
  { key: 'unit-non-pusat', code: 'PLN_PUSAT', name: 'PLN Kantor Pusat', type: 'NON_UPDL', region: 'Non-UPDL', focus: 'Kantor Pusat PT PLN (Persero).' },
  { key: 'unit-non-uid-jkt', code: 'UID_JKT', name: 'PLN UID Jakarta Raya', type: 'NON_UPDL', region: 'Non-UPDL', focus: 'Unit Induk Distribusi Jakarta Raya.' },
  { key: 'unit-non-puslitbang', code: 'PUSLITBANG', name: 'PLN Puslitbang', type: 'NON_UPDL', region: 'Non-UPDL', focus: 'Pusat Penelitian dan Pengembangan Ketenagalistrikan.' },
  { key: 'unit-non-pusharlis', code: 'PUSHARLIS', name: 'PLN Pusharlis', type: 'NON_UPDL', region: 'Non-UPDL', focus: 'Pusat Pemeliharaan Ketenagalistrikan.' },
  { key: 'unit-non-icon-plus', code: 'ICON_PLUS_JAMSOSTEK', name: 'PLN Icon Plus Jamsostek', type: 'NON_UPDL', region: 'Non-UPDL', focus: 'Layanan Icon Plus pada lingkungan Jamsostek.' }
];

export const categories = [
  { key: 'cat-net', name: 'Jaringan dan Internet', desc: 'Kendala koneksi LAN, Wi-Fi CorpU, VPN, dan bandwidth internet gedung pelatihan.' },
  { key: 'cat-hw', name: 'Perangkat Keras', desc: 'Kerusakan PC, laptop instruktur, printer, scanner, dan periferal kerja.' },
  { key: 'cat-sw', name: 'Perangkat Lunak', desc: 'Instalasi, lisensi, dan pembaruan software operasional dan simulasi kelistrikan.' },
  { key: 'cat-acc', name: 'Akun dan Hak Akses', desc: 'Permintaan reset password, aktivasi akun baru, dan permohonan akses shared folder.' },
  { key: 'cat-app', name: 'Aplikasi Internal', desc: 'Gangguan atau galat pada sistem ERP SAP, portal kehadiran, dan e-Office PLN CorpU.' },
  { key: 'cat-lms', name: 'Sistem Pembelajaran (HXMS)', desc: 'Pengelolaan modul e-learning, ujian daring, kuis, dan materi pembelajaran di LMS/HSMS CorpU.' },
  { key: 'cat-cls', name: 'Kelas dan Fasilitas Pelatihan', desc: 'Perangkat AV, Smart Board, proyektor, mikrofon ruang auditorium dan kelas interaktif.' },
  { key: 'cat-srp', name: 'Sarana dan Prasarana', desc: 'Dukungan AC ruang server/kelas, pasokan daya UPS lab komputer, dan kelistrikan gedung.' },
  { key: 'cat-adm', name: 'Administrasi Diklat', desc: 'Permintaan sertifikat elektronik diklat, perubahan jadwal kelas, dan presensi pelatihan.' },
  { key: 'cat-oth', name: 'Permintaan Layanan Lainnya', desc: 'Layanan konsultasi teknologi, asistensi event hybrid, dan permohonan khusus lainnya.' }
];

export const slaList = [
  { priority: 'Kritis', response: 15, resolve: 4, desc: 'Dampak melumpuhkan kegiatan kelas besar atau server pusat CorpU.' },
  { priority: 'Tinggi', response: 30, resolve: 12, desc: 'Dampak terhadap satu departemen atau kelas diklat aktif.' },
  { priority: 'Sedang', response: 60, resolve: 24, desc: 'Gangguan pada individu atau tim kecil dengan dampak terkendali.' },
  { priority: 'Rendah', response: 120, resolve: 48, desc: 'Permintaan layanan standar, instalasi rutin, dan permohonan umum.' }
];
