
/**
 * users.js — preîncarcă persoane în aplicația de pontaj.
 * Cum se folosește:
 * 1) Copiază acest fișier în proiect la `js/users.js`.
 * 2) Include-l ÎNAINTE de `js/app.js` în `index.html`, de ex.:
 *      <script src="js/users.js"></script>
 *      <script src="js/app.js"></script>
 * 3) Editează array‑ul PF_PRELOADED_PERSONS de mai jos.
 *
 * Chei folosite de aplicație:
 *   - LS_PERSONS = 'pf_persons'
 * Structură persoană: { name: 'Nume Prenume', id: '1234', grade: 'Director' }
 */
(function(){
  const LS_PERSONS = 'pf_persons';

  // === EDITEAZĂ AICI LISTA TA INIȚIALĂ (exemple) ===
  // Poți șterge exemplele și pune datele tale.
  window.PF_PRELOADED_PERSONS = window.PF_PRELOADED_PERSONS || [
    { name: 'Marius', id: '138', grade: 'Director' },
    { name: 'Maria Ionescu', id: '1002', grade: 'Vice-Director' },
    { name: 'Andrei Georgescu', id: '2001', grade: 'Medic Specialist' }
  ];

  // Dacă nu e nimic de preîncărcat, ieșim.
  const preload = Array.isArray(window.PF_PRELOADED_PERSONS) ? window.PF_PRELOADED_PERSONS : [];
  if (!preload.length) return;

  // Citim ce există deja în localStorage
  let existing = [];
  try {
    existing = JSON.parse(localStorage.getItem(LS_PERSONS) || '[]');
    if (!Array.isArray(existing)) existing = [];
  } catch(e){
    existing = [];
  }

  // Funcție de cheie unică: (id + nume lowercased)
  const keyOf = (p) => `${String(p.id||'').trim()}::${String(p.name||'').toLowerCase().trim()}`;

  // Mapăm existenții pentru un merge fără duplicate
  const map = new Map(existing.map(p => [keyOf(p), p]));

  // Validăm & adăugăm persoane din preload
  preload.forEach(p => {
    if (!p || !p.name || !p.id || !p.grade) return;
    map.set(keyOf(p), { name: String(p.name).trim(), id: String(p.id).trim(), grade: String(p.grade).trim() });
  });

  // Salvăm în localStorage
  const merged = Array.from(map.values());
  try {
    localStorage.setItem(LS_PERSONS, JSON.stringify(merged));
    console.log(`[users.js] Preîncărcat ${merged.length} persoane în ${LS_PERSONS}.`);
  } catch(e){
    console.error('[users.js] Eroare la salvarea în localStorage:', e);
  }
})();
