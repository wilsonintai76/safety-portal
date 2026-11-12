export interface SafetyTip {
  id: string;
  category: 'Fizikal' | 'Elektrik' | 'Kimia' | 'Ergonomik' | 'PPE' | 'Mesin & Peralatan' | 'Kecemasan' | 'Kebersihan (Housekeeping)';
  title: string;
  tip: string;
  actReference: string;
  recommendedAction: string;
}

export class SafetyTipLibrary {
  private static tips: SafetyTip[] = [
    {
      id: 'tip-osh-01',
      category: 'Mesin & Peralatan',
      title: 'Pemeriksaan Peranti Perlindungan Interlocking Machine Guarding',
      tip: 'Pastikan adang perlindungan (machine guard) pada mesin larik, mesin kisar, dan EDM Wire Cut sentiasa dipasang dan berfungsi sebelum memulakan punca kuasa. Jangan sekali-kali menyahaktifkan suis keselamatan automatik.',
      actReference: 'Akta OSHA 1994 Seksyen 15 & Peraturan JKKP (Jentera Berkuasa)',
      recommendedAction: 'Periksa suis interlocking dan penutup fizikal sebelum mula operasi.'
    },
    {
      id: 'tip-osh-02',
      category: 'PPE',
      title: 'Pemakaian Kasut Keselamatan dengan Pelindung Jari Keluli (Steel Toe Cap)',
      tip: 'Wajib memakai kasut keselamatan yang diiktiraf SIRIM/DOSH semasa berada di dalam bengkel JKM. Kasut biasa atau selipar tidak mampu melindungi kaki daripada hentaman bendakerja berat atau tumpuan bahan api.',
      actReference: 'Akta 514 Seksyen 24 (Kewajipan Pekerja & Pelajar)',
      recommendedAction: 'Pastikan kasut bertutup sepenuhnya dan melepasi ujian ketahanan impact 200 Joules.'
    },
    {
      id: 'tip-osh-03',
      category: 'Elektrik',
      title: 'Sistem Pembumian & Ujian Bulanan Pemutus Litar ELCB/RCD',
      tip: 'Pastikan kotak pengagihan elektrik (DB Box) di bengkel dilengkapi Pemutus Litar Arus Baki (ELCB/RCD) berkadar sensitiviti ≤30mA dan diuji butang "TEST" sekurang-kurangnya sebulan sekali.',
      actReference: 'Peraturan-Peraturan Elektrik 1994 & Standard MS IEC 60364',
      recommendedAction: 'Tekan butang ujian ELCB dan pastikan bekalan terputus serta-merta.'
    },
    {
      id: 'tip-osh-04',
      category: 'Ergonomik',
      title: 'Teknik Mengangkat Beban Berat (Manual Handling)',
      tip: 'Gunakan teknik "Bengkokkan Lutut, Luruskan Belakang" semasa mengangkat alat atau stok bahan keluli dari lantai. Minta bantuan rakan atau gunakan forklift/hoist jika beban melebihi 20kg.',
      actReference: 'Garis Panduan Pengendalian Manual JKKP 2018',
      recommendedAction: 'Dekatkan beban ke badan dan gunakan kekuatan otot kaki, bukan belakang.'
    },
    {
      id: 'tip-osh-05',
      category: 'Kimia',
      title: 'Rujukan Helaian Data Keselamatan (SDS/MSDS)',
      tip: 'Semak Helaian Data Keselamatan (SDS) sebelum menggunakan bendalir pemotong (coolant), bahan pelarut, atau gas pemotong oksi-asetilena. Pastikan keamatan pengudaraan ekzos tempatan (LEV) mencukupi.',
      actReference: 'Peraturan CLASS 2013 & USECHH 2000',
      recommendedAction: 'Pastikan tong kimia mempunyai label berpiktogram GHS yang sah.'
    },
    {
      id: 'tip-osh-06',
      category: 'Kecemasan',
      title: 'Kelancaran Laluan Keluar Kecemasan & Stesen Pemadam Api',
      tip: 'Dilarang menghalang laluan keluar kecemasan, pintu rintangan api, atau akses ke peti pemadam api jenis CO2/Debu Kering dengan barang alat atau sisa bahan buangan bengkel.',
      actReference: 'Akta Perkhidmatan Bomba 1988 (Akta 341)',
      recommendedAction: 'Kekalkan kelegaan minimum 1 meter di hadapan semua alat pemadam api.'
    },
    {
      id: 'tip-osh-07',
      category: 'Kebersihan (Housekeeping)',
      title: 'Prinsip Amalan 5S & Sisa Tatal Mesin (Swarf)',
      tip: 'Bersihkan serpihan tatal besi (swarf) menggunakan penyapu atau pengaut sisa, bukannya dengan tangan bertelanjang atau tiupan angin mampat (compressed air) yang bertekanan tinggi.',
      actReference: 'Garis Panduan Amalan Kebersihan Bengkel JKKP 2008',
      recommendedAction: 'Gunakan berus swarf khas dan buang ke dalam bekas sisa logam berpintu.'
    },
    {
      id: 'tip-osh-08',
      category: 'Mesin & Peralatan',
      title: 'Prosedur Penutupan Tenaga Selamat LOTO (Lockout / Tagout)',
      tip: 'Sebelum menjalankan kerja penyelenggaraan atau pembaikan pada mesin pencanai (pedestal grinder) atau relau tuangan, kunci punca kuasa elektrik utama dan gantung tag amaran "JANGAN HIDUPKAN".',
      actReference: 'Standard OSH ISO 45001 & Garis Panduan LOTO JKKP',
      recommendedAction: 'Pasang kunci pad dan kunci tag penutupan sebelum menyelenggara.'
    },
    {
      id: 'tip-osh-09',
      category: 'PPE',
      title: 'Perlindungan Pendengaran di Kawasan Bising >85dB(A)',
      tip: 'Pakai penyumbat telinga (earplugs) atau penutup telinga (earmuffs) apabila beroperasi di bengkel kimpalan atau semasa mesin pemotongan kepingan logam beroperasi melebihi tahap julat pendedahan bising 85 dB(A).',
      actReference: 'Peraturan Keselamatan & Kesihatan Pekerjaan (Pendedahan Bising) 2019',
      recommendedAction: 'Gunakan penutup telinga bertaraf NRR ≥ 25dB di zon berbunyi bising.'
    },
    {
      id: 'tip-osh-10',
      category: 'Kimia',
      title: 'Penyimpanan Silinder Gas Mampat Berasingan',
      tip: 'Silinder gas Oksigen dan Asetilena mestilah disimpan secara menegak, diikat dengan rantai keselamatan, dan dipisahkan sekurang-kurangnya 6 meter atau dipisahkan oleh penghalang rintangan api 1.5 meter.',
      actReference: 'Garis Panduan Keselamatan Silinder Gas JKKP',
      recommendedAction: 'Pastikan penutup injap silinder dipasang ketat semasa tidak digunakan.'
    },
    {
      id: 'tip-osh-11',
      category: 'Kecemasan',
      title: 'Pemeriksaan Kandungan Peti Pertolongan Cemas (First Aid Box)',
      tip: 'Pastikan Peti Pertolongan Cemas di setiap makmal JKM sentiasa dilengkapi dengan ubat luaran, kain pembalut steril, cecair cuci mata (eyewash), dan sarung tangan getah yang belum tamat tempoh.',
      actReference: 'Peraturan KKP (Pertolongan Cemas) JKKP / PK-06(1)',
      recommendedAction: 'Lakukan audit senarai item peti cemas sekurang-kurangnya sekali sebulan.'
    },
    {
      id: 'tip-osh-12',
      category: 'Mesin & Peralatan',
      title: 'Jarak Pelepasan Kelonggaran Mata Pencanai (Grinding Tool Rest)',
      tip: 'Setkan tongkat sokongan (tool rest) pada mesin pencanai (pedestal grinder) supaya jarak kelegaan dari roda pencanai tidak melebihi 3mm untuk mengelakkan bendakerja tersepit.',
      actReference: 'Standard Keselamatan Jentera Pencanai DOSH/JKKP',
      recommendedAction: 'Ukur kelegaan tongkat pencanai dengan tolok peraba sebelum menghidupkan suis.'
    }
  ];

  public static getRandomTip(): SafetyTip {
    const randomIndex = Math.floor(Math.random() * this.tips.length);
    return this.tips[randomIndex];
  }

  public static getAllTips(): SafetyTip[] {
    return this.tips;
  }
}
