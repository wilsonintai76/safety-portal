import React from 'react';
import { HirarcData, ChecklistData } from '../types/safety';
import { getRiskLevel, INITIAL_CHECKLIST_SECTIONS } from '../data/presets';

interface PrintDocumentProps {
  mode: 'HIRARC' | 'L2B';
  isBlank?: boolean;
  hirarcData?: HirarcData;
  checklistData?: ChecklistData;
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  mode,
  isBlank = false,
  hirarcData,
  checklistData
}) => {
  const formatDatePretty = (dStr?: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

  if (mode === 'HIRARC') {
    const h = hirarcData || {
      hirNo: '01',
      title: 'MESIN AM',
      dept: 'MECHANICAL ENGINEERING DEPARTMENT',
      location: 'HIGH TECH LAB',
      preparedBy: '',
      date: '',
      rows: []
    };

    const rowsToPrint = isBlank ? Array(8).fill(null) : h.rows;

    return (
      <div id="print-root" style={{ backgroundColor: '#ffffff', padding: '10px 14px' }}>
        <style>{`
          @page { size: A4 landscape; margin: 8mm 10mm; }
        `}</style>

        {/* Header Lampiran 1 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
              HAZARD IDENTIFICATION, RISK ASSESSMENT &amp; RISK CONTROL TABLE (HIRARC) FORM
            </div>
          </div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', textAlign: 'right' }}>
            LAMPIRAN 1
          </div>
        </div>

        {/* Metadata Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', fontSize: '8.5pt' }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', width: '180px', padding: '2px 4px' }}>TITLE</td>
              <td style={{ padding: '2px 4px' }}>
                : {isBlank ? '..................................................................' : h.title}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', padding: '2px 4px' }}>DEPARTMENT</td>
              <td style={{ padding: '2px 4px' }}>
                : {isBlank ? 'MECHANICAL ENGINEERING DEPARTMENT' : h.dept || 'MECHANICAL ENGINEERING DEPARTMENT'}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', padding: '2px 4px' }}>LOCATION/EQUIPMENT</td>
              <td style={{ padding: '2px 4px' }}>
                : {isBlank ? '..................................................................' : h.location}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main HIRARC Table (Exact 13 Columns matching Lampiran 1 PK-06) */}
        <table className="print-table">
          <thead>
            <tr>
              <th colSpan={6} style={{ borderBottom: 'none' }}>1. HAZARD IDENTIFICATION</th>
              <th colSpan={3} style={{ borderBottom: 'none' }}>2. RISK ANALYSIS</th>
              <th colSpan={4} style={{ borderBottom: 'none' }}>3. RISK CONTROL</th>
            </tr>
            <tr>
              <th style={{ width: '25px' }}>NO</th>
              <th style={{ width: '36px' }}>R/NR</th>
              <th style={{ width: '160px' }}>WORK ACTIVITY</th>
              <th style={{ width: '145px' }}>HAZARD</th>
              <th style={{ width: '145px' }}>EFFECT</th>
              <th style={{ width: '150px' }}>EXISTING CONTROL</th>
              <th style={{ width: '28px' }}>L</th>
              <th style={{ width: '28px' }}>S</th>
              <th style={{ width: '36px' }}>RISK</th>
              <th>RECOMMENDED CONTROL MEASURES</th>
              <th style={{ width: '70px' }}>PIC</th>
              <th style={{ width: '75px' }}>DUE DATE</th>
              <th style={{ width: '80px' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rowsToPrint.map((r, index) => {
              if (isBlank || !r) {
                return (
                  <tr key={index} style={{ height: '14mm' }}>
                    <td className="c">{index + 1}</td>
                    <td className="c"></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="c"></td>
                    <td className="c"></td>
                    <td className="c"></td>
                    <td></td>
                    <td></td>
                    <td className="c"></td>
                    <td className="c"></td>
                  </tr>
                );
              }

              const score = r.l * r.s;
              const risk = getRiskLevel(score);

              return (
                <tr key={r.id || index}>
                  <td className="c">{index + 1}</td>
                  <td className="c font-bold">{r.rnr || 'R'}</td>
                  <td>{r.workActivity}</td>
                  <td>{r.hazard}</td>
                  <td>{r.effect}</td>
                  <td style={{ whiteSpace: 'pre-line' }}>{r.existingControl}</td>
                  <td className="c tabular-nums">{r.l}</td>
                  <td className="c tabular-nums">{r.s}</td>
                  <td className={`c tabular-nums ${risk.printClass}`}>{score}</td>
                  <td>{r.recommendedControl}</td>
                  <td>{r.pic}</td>
                  <td className="c">{formatDatePretty(r.dueDate)}</td>
                  <td className={`c ${r.status === 'Selesai' ? 'font-bold text-emerald-800' : ''}`}>
                    {r.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer Lampiran 1 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '8pt', pageBreakInside: 'avoid' }}>
          <div style={{ width: '60%' }}>
            <div><strong>HIRARC NUMBER :</strong> {isBlank ? '............' : (h.hirNo || '01')}</div>
            <div><strong>PREPARE BY :</strong> {isBlank ? '........................................................' : h.preparedBy}</div>
            <div><strong>DATE :</strong> {isBlank ? '........................' : formatDatePretty(h.date)}</div>
            <div style={{ fontSize: '7.5pt', lineHeight: 1.3, borderTop: '1px solid #444', paddingTop: '3px', marginTop: '4px' }}>
              <strong>NOTES:</strong><br />
              R/NR: Routine/Non-routine | L: Likelihood | S: Severity | PIC: Person In Charge<br />
              Skala Risiko: 1–4 Low (Boleh diterima) | 5–12 Medium (Terancang) | 15–25 High (Tindakan Segera)
            </div>
          </div>
          <div style={{ textAlign: 'right', width: '38%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span style={{ border: '1px solid #000', padding: '2px 6px', fontWeight: 'bold' }}>
                PK-06(1)(01-07-22)
              </span>
            </div>
            <div style={{ marginTop: '20px', fontSize: '7.5pt', color: '#444' }}>
              Dokumen Rasmi Jabatan Kejuruteraan Mekanikal
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lampiran 2B (Portrait)
  const l = checklistData || {
    nama: '',
    lokasi: '',
    tarikh: '',
    items: []
  };

  let yaCount = 0;
  let tidakCount = 0;
  let naCount = 0;

  if (!isBlank && l.items) {
    l.items.forEach((it) => {
      if (it.jawapan === 'Ya') yaCount++;
      else if (it.jawapan === 'Tidak') tidakCount++;
      else if (it.jawapan === 'NA') naCount++;
    });
  }

  const compliance = yaCount + tidakCount > 0 ? Math.round((yaCount / (yaCount + tidakCount)) * 100) : 100;

  return (
    <div id="print-root" style={{ backgroundColor: '#ffffff', padding: '14px 16px' }}>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
      `}</style>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13pt', marginBottom: '2px' }}>
        SENARAI SEMAK PEMERIKSAAN KESELAMATAN BENGKEL
      </div>
      <div style={{ textAlign: 'center', fontSize: '9pt', marginBottom: '10px' }}>
        LAMPIRAN 2B - JABATAN KEJURUTERAAN MEKANIKAL (PK-06)
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '8.5pt' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 'bold', width: '130px', padding: '2px 0' }}>Nama Pemeriksa</td>
            <td>: {isBlank ? '............................................................' : l.nama}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '2px 0' }}>Lokasi / Bengkel</td>
            <td>: {isBlank ? '............................................................' : l.lokasi}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '2px 0' }}>Tarikh Pemeriksaan</td>
            <td>: {isBlank ? '............................' : formatDatePretty(l.tarikh)}</td>
          </tr>
        </tbody>
      </table>

      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: '30px' }}>Bil</th>
            <th>Perkara Pemeriksaan</th>
            <th style={{ width: '40px' }}>Ya</th>
            <th style={{ width: '40px' }}>Tidak</th>
            <th style={{ width: '40px' }}>NA</th>
            <th style={{ width: '180px' }}>Catatan / Tindakan Pembetulan</th>
          </tr>
        </thead>
        <tbody>
          {INITIAL_CHECKLIST_SECTIONS.map((sec, sIdx) => {
            return (
              <React.Fragment key={sIdx}>
                <tr>
                  <td colSpan={6} style={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
                    {sec.seksyen}
                  </td>
                </tr>
                {sec.items.map((itemText, iIdx) => {
                  const globalIdx = sIdx * 4 + iIdx + 1;
                  const found = isBlank ? null : l.items?.find((x) => x.item === itemText);

                  return (
                    <tr key={iIdx}>
                      <td className="c">{globalIdx}</td>
                      <td>{itemText}</td>
                      <td className="c font-bold">{found?.jawapan === 'Ya' ? '✔' : ''}</td>
                      <td className="c font-bold text-red-600">{found?.jawapan === 'Tidak' ? '✔' : ''}</td>
                      <td className="c font-bold">{found?.jawapan === 'NA' ? '✔' : ''}</td>
                      <td>{found?.catatan || ''}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {!isBlank && (
        <div style={{ fontSize: '8.5pt', marginTop: '6px', fontWeight: 'bold' }}>
          Keputusan Pematuhan: {compliance}% (Ya: {yaCount}, Tidak: {tidakCount}, NA: {naCount})
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '35px', fontSize: '8.5pt' }}>
        <div style={{ width: '42%', borderTop: '1px solid #000', paddingTop: '5px' }}>
          <strong>Tandatangan Pemeriksa / Pegawai</strong>
          <br />
          Nama: {isBlank ? '' : l.nama}
          <br />
          Tarikh: {isBlank ? '' : formatDatePretty(l.tarikh)}
        </div>
        <div style={{ width: '42%', borderTop: '1px solid #000', paddingTop: '5px' }}>
          <strong>Disahkan oleh Ketua Bengkel / Pegawai KKP</strong>
          <br />
          Nama:
          <br />
          Tarikh:
        </div>
      </div>
    </div>
  );
};
