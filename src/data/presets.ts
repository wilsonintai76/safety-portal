

export const TITLE_SUGGESTIONS = [
  'EDM WIRE CUT',
  'CNC LATHE MACHINE',
  'CNC MILLING',
  'CNC ROUTER',
  'OPERASI MESIN LARIK KONVENSIONAL',
  'OPERASI MESIN PENCANAI (PEDESTAL GRINDER)',
  'OPERASI MESIN GERUDI (RADIAL DRILLING)',
  'KERJA KIMPALAN ARKA LOGAM TERLINDUNG (SMAW)',
  'KERJA MEMOTONG GAS OKSI-ASETILENA',
  'KERJA KIMPALAN TIG & MIG (GTAW/GMAW)',
  'OPERASI RELAU TUANGAN (CRUCIBLE FURNACE)',
  'PEMBUATAN ACUAN PASIR (SAND CASTING)',
  'SERVIS & PENYELENGGARAAN ENJIN',
  'PENGENDALIAN BAHAN KIMIA & PENYEJUK (RAC)',
  'UJIAN MEKANIKAL & KEKUATAN BAHAN (TENSILE TEST)'
];

export const LIKELIHOOD_DEF: Record<number, { text: string; desc: string }> = {
  5: { text: '5 - Most likely', desc: 'Hasil yang paling mungkin berlaku sekiranya hazard timbul.' },
  4: { text: '4 - Possible', desc: 'Mempunyai kebarangkalian besar untuk berlaku & bukan perkara luar biasa.' },
  3: { text: '3 - Conceivable', desc: 'Boleh dijangka berlaku pada masa akan datang.' },
  2: { text: '2 - Remote', desc: 'Jarang berlaku dan tidak pernah diketahui berlaku selepas bertahun-tahun.' },
  1: { text: '1 - Inconceivable', desc: 'Hampir mustahil dan tidak pernah direkodkan berlaku.' }
};

export const SEVERITY_DEF: Record<number, { text: string; desc: string }> = {
  5: { text: '5 - Catastrophic', desc: 'Kematian ramai, kerosakan harta benda yang musnah kekal & kehilangan daya produktiviti.' },
  4: { text: '4 - Fatal', desc: 'Kira-kira 1 kematian, kerosakan harta benda besar jika bahaya menjadi kenyataan.' },
  3: { text: '3 - Serious', desc: 'Kecederaan bukan maut, hilang upaya kekal.' },
  2: { text: '2 - Minor', desc: 'Hilang keupayaan bekerja tetapi bukan kecederaan kekal.' },
  1: { text: '1 - Negligible', desc: 'Calar ringan, lebam, luka kecil atau kecederaan pertolongan cemas ringan sahaja.' }
};

export const RISK_ACTION_GUIDE = {
  high: {
    range: '15 â€“ 25 (HIGH)',
    level: 'High' as const,
    action: 'Memerlukan tindakan segera untuk mengawal hazard mengikut hirarki kawalan. Tindakan mesti didokumentasikan berserta tarikh sasaran siap.'
  },
  medium: {
    range: '5 â€“ 12 (MEDIUM)',
    level: 'Medium' as const,
    action: 'Memerlukan pendekatan terancang untuk mengawal hazard dan menggunakan langkah sementara jika perlu. Didokumenkan berserta tarikh siap.'
  },
  low: {
    range: '1 â€“ 4 (LOW)',
    level: 'Low' as const,
    action: 'Boleh diterima dan pengurangan selanjutnya mungkin tidak diperlukan. Namun kawalan cepat dan efisien tetap disyorkan.'
  }
};

export function getRiskLevel(score: number): { level: 'Low' | 'Medium' | 'High'; badgeClass: string; printClass: string } {
  if (score >= 15) {
    return { level: 'High', badgeClass: 'badge-high', printClass: 'p-high' };
  }
  if (score >= 5) {
    return { level: 'Medium', badgeClass: 'badge-med', printClass: 'p-med' };
  }
  return { level: 'Low', badgeClass: 'badge-low', printClass: 'p-low' };
}

export const INITIAL_CHECKLIST_SECTIONS = [
  {
    seksyen: 'A. Persekitaran Kerja & Laluan',
    items: [
      'Lantai bersih, kering dan bebas daripada sebarang halangan atau tumpahan minyak/cecair licin.',
      'Laluan kecemasan tidak terhalang dan ditanda dengan garisan kuning yang jelas.',
      'Pencahayaan mencukupi di semua ruang kerja, lorong laluan dan zon pengendalian mesin.',
      'Sistem pengudaraan di dalam bengkel/makmal berfungsi dengan baik dan lancar.'
    ]
  },
  {
    seksyen: 'B. Jentera, Mesin & Peralatan Bengkel',
    items: [
      'Semua bahagian berputar / bahaya (gear, tali sawat, cuk) dilengkapi pengadang keselamatan (safety guard).',
      'Butang henti kecemasan (Emergency Stop) berfungsi sepenuhnya dan mudah dicapai oleh operator.',
      'SOP pengendalian selamat (Safe Operating Procedure) dipamerkan dengan jelas berdekatan mesin.',
      'Hanya pengguna / pelajar yang telah diberi taklimat dan kebenaran sahaja mengendalikan mesin.'
    ]
  },
  {
    seksyen: 'C. Bahan Kimia & Penyejuk (Coolant)',
    items: [
      'Bekas bahan kimia dan minyak dilabel dengan betul mengikut Peraturan CLASS JKKP.',
      'Helaian Data Keselamatan (Safety Data Sheet - SDS) sedia ada dan mudah diakses oleh staf/pelajar.',
      'Tiada kebocoran cecair penyejuk (coolant) atau minyak pelincir di lantai sekitar mesin.'
    ]
  },
  {
    seksyen: 'D. Keselamatan Elektrik & Kebakaran',
    items: [
      'Semua peralatan elektrik dibumikan dan penebat kabel dalam keadaan sempurna tanpa retakan.',
      'Alat pemadam api dalam tempoh sah pemeriksaan berkala (bomba/vendor) dan tidak dihalang oleh objek.',
      'Kotak pertolongan cemas (First Aid Kit) lengkap dengan bekalan ubat/pembalut yang mencukupi & belum luput.'
    ]
  },
  {
    seksyen: 'E. Peralatan Pelindung Diri (PPE)',
    items: [
      'Semua pengguna dan pelajar memakai kasut keselamatan bertutup (safety shoes) semasa berada di bengkel.',
      'Gogal / pelindung mata dan penutup telinga (ear plug/muff) digunakan mengikut keperluan amali.',
      'Pakaian bengkel / apron kemas, tidak longgar, rambut diikat rapi dan barang kemas ditanggalkan.'
    ]
  }
];

