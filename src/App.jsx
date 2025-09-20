
import React, { useEffect, useMemo, useState } from 'react'

// Keys
const STORAGE_KEY = 'quizclass_results_v1'
const UI_SCALE_KEY = 'quizclass_ui_scale'
const THEME_KEY = 'quizclass_theme'            // 'auto' | 'light' | 'dark'
const DENSITY_KEY = 'quizclass_density'        // 'comfy' | 'compact'
const FONT_KEY = 'quizclass_font'              // 'sans' | 'serif' | 'dys'
const PASS_KEY = 'quizclass_pass_threshold'    // 0-100
const IMMEDIATE_KEY = 'quizclass_immediate'    // '0' | '1'
const ONLYERR_KEY = 'quizclass_onlyerrors'     // '0' | '1'
const CHAPTER_STATS_KEY = 'quizclass_results_by_chapter'
const CLASS_DATA_KEY = 'quizclass_class_scores' // optional

// CSV helpers


function detectDelimiter(sample) {
  const lines = sample.split(/\r?\n/).slice(0, 10);
  let c = 0, s = 0;
  for (const l of lines) {
    c += (l.match(/,/g) || []).length;
    s += (l.match(/;/g) || []).length;
  }
  return s > c ? ';' : ',';
}

function splitCSVLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCSV(text) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const delim = detectDelimiter(cleaned);
  const rows = cleaned.split('\n').filter((l) => l.length > 0);
  if (!rows.length) return { items: [], warnings: ['File CSV vuoto'] };

  const headers = splitCSVLine(rows[0], delim).map((s) => s.toLowerCase().trim());
  const H = (name) => headers.indexOf(name);

  const idx = {
    domanda: (() => {
      const cand = ['domanda', 'quesito', 'question', 'testo', 'prompt'];
      for (const k of cand) { const i = H(k); if (i >= 0) return i; }
      return 0;
    })(),
    a: -1, b: -1, c: -1, d: -1,
    n1: H('1'), n2: H('2'), n3: H('3'), n4: H('4'),
    risposta: (() => {
      const cand = ['risposta', 'answer', 'corretta', 'correct', 'soluzione'];
      for (const k of cand) { const i = H(k); if (i >= 0) return i; }
      return -1;
    })(),
    risposta_num: (() => {
      const cand = ['risposta corretta', 'indice', 'answer index', 'correct index', 'numero risposta'];
      for (const k of cand) { const i = H(k); if (i >= 0) return i; }
      return -1;
    })(),
  };

  // Direct A-D
  for (const lab of ['a', 'b', 'c', 'd']) {
    const i = H(lab);
    if (i >= 0) idx[lab] = i;
  }
  // "opzione a" / "risposta a" / "option a"
  const fallbacks = {
    a: ['opzione a', 'risposta a', 'option a'],
    b: ['opzione b', 'risposta b', 'option b'],
    c: ['opzione c', 'risposta c', 'option c'],
    d: ['opzione d', 'risposta d', 'option d'],
  };
  for (const lab of ['a', 'b', 'c', 'd']) {
    if (idx[lab] === -1) {
      for (const nm of fallbacks[lab]) {
        const i = H(nm);
        if (i >= 0) { idx[lab] = i; break; }
      }
    }
  }
  // If still missing, take the four columns after question
  const qIdx = idx.domanda;
  const ensure = (lab, off) => {
    if (idx[lab] === -1) {
      const j = qIdx + off;
      if (j < headers.length) idx[lab] = j;
    }
  };
  ensure('a', 1); ensure('b', 2); ensure('c', 3); ensure('d', 4);

  const items = [];
  const warnings = [];
  const mapNumToLetter = (v) => {
    const n = Number(String(v).trim());
    return ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' }[n] || '');
  };

  for (let r = 1; r < rows.length; r++) {
    const row = splitCSVLine(rows[r], delim);
    const rowNo = r + 1;
    const pick = (ix) => ((ix >= 0 && ix < row.length) ? (row[ix] || '').trim() : '');

    const q = pick(idx.domanda);
    const oRaw = [idx.a, idx.b, idx.c, idx.d].map(pick).map((s) => s.replace(/^\*/, '').trim());
    const nRaw = [idx.n1, idx.n2, idx.n3, idx.n4].map(pick);
    for (let k = 0; k < 4; k++) {
      if (!oRaw[k] && nRaw[k]) oRaw[k] = nRaw[k];
    }
    const opts = oRaw.filter(Boolean);

    const rawLetter = pick(idx.risposta);
    const rawNum = pick(idx.risposta_num);
    let answerIndex = -1;

    if (rawNum) {
      const L = mapNumToLetter(rawNum).toLowerCase();
      if (['a', 'b', 'c', 'd'].includes(L)) {
        const pos = { a: 0, b: 1, c: 2, d: 3 }[L];
        const val = oRaw[pos];
        const idxInOpts = opts.indexOf(val);
        if (idxInOpts >= 0) answerIndex = idxInOpts;
      }
    }
    if (answerIndex < 0 && rawLetter) {
      if (/^[abcd]$/i.test(rawLetter)) {
        const L = rawLetter.toLowerCase();
        const pos = { a: 0, b: 1, c: 2, d: 3 }[L];
        const val = oRaw[pos];
        const idxInOpts = opts.indexOf(val);
        if (idxInOpts >= 0) answerIndex = idxInOpts;
      } else {
        const idxText = opts.findIndex((o) => o.toLowerCase() === rawLetter.toLowerCase());
        if (idxText >= 0) answerIndex = idxText;
      }
    }

    if (q && opts.length >= 2 && answerIndex >= 0) {
      items.push({ question: q, options: opts, answerIndex });
    } else {
      if (!q) warnings.push(`Riga ${rowNo}: domanda mancante`);
      if (opts.length < 2) warnings.push(`Riga ${rowNo}: servono almeno 2 opzioni valorizzate`);
      if (answerIndex < 0) warnings.push(`Riga ${rowNo}: risposta mancante o non riconosciuta`);
    }
  }

  return { items, warnings };
}
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

export default function App() {
  const [catalog, setCatalog] = useState({ subjects: [] })
  const [current, setCurrent] = useState({ subject: null, chapter: null })
  const [items, setItems] = useState([])
  const [warnings, setWarnings] = useState([])
  const [mode, setMode] = useState('practice')
  const [shuffleOn, setShuffleOn] = useState(true)
  const [answers, setAnswers] = useState({})
  const [score, setScore] = useState(null)
  const [loading, setLoading] = useState(false)

  // UI prefs
  const [scale, setScale] = useState(() => { try { return Number(localStorage.getItem(UI_SCALE_KEY) || '1.1') } catch { return 1.1 } })
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(THEME_KEY) || 'auto' } catch { return 'auto' } })
  const [density, setDensity] = useState(() => { try { return localStorage.getItem(DENSITY_KEY) || 'comfy' } catch { return 'comfy' } })
  const [font, setFont] = useState(() => { try { return localStorage.getItem(FONT_KEY) || 'sans' } catch { return 'sans' } })
  const [passThreshold, setPassThreshold] = useState(() => { try { return Number(localStorage.getItem(PASS_KEY) || '60') } catch { return 60 } })
  const [immediate, setImmediate] = useState(() => { try { return localStorage.getItem(IMMEDIATE_KEY) === '1' } catch { return false } })
  const [onlyErrors, setOnlyErrors] = useState(() => { try { return localStorage.getItem(ONLYERR_KEY) === '1' } catch { return false } })

  useEffect(() => { document.documentElement.style.setProperty('--scale', String(scale)); try { localStorage.setItem(UI_SCALE_KEY, String(scale)) } catch {} }, [scale])
  useEffect(() => { const root = document.documentElement; root.classList.remove('theme-light','theme-dark'); if (theme==='light') root.classList.add('theme-light'); else if (theme==='dark') root.classList.add('theme-dark'); try { localStorage.setItem(THEME_KEY, theme) } catch {} }, [theme])
  useEffect(() => { const root = document.documentElement; root.classList.remove('density-compact','density-comfy'); root.classList.add(density==='compact'?'density-compact':'density-comfy'); try { localStorage.setItem(DENSITY_KEY, density) } catch {} }, [density])
  useEffect(() => { const root = document.documentElement; root.classList.remove('font-serif','font-dys'); if (font==='serif') root.classList.add('font-serif'); if (font==='dys') root.classList.add('font-dys'); try { localStorage.setItem(FONT_KEY, font) } catch {} }, [font])
  useEffect(() => { try { localStorage.setItem(PASS_KEY, String(passThreshold)) } catch {} }, [passThreshold])
  useEffect(() => { try { localStorage.setItem(IMMEDIATE_KEY, immediate ? '1' : '0') } catch {} }, [immediate])
  useEffect(() => { try { localStorage.setItem(ONLYERR_KEY, onlyErrors ? '1' : '0') } catch {} }, [onlyErrors])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (!e.altKey) return
      const k = e.key?.toLowerCase()
      if (k === 'd') setTheme(t => t==='auto' ? 'dark' : t==='dark' ? 'light' : 'auto')
      if (k === 'i') setImmediate(v => !v)
      if (k === 'o') setOnlyErrors(v => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/data/catalog.json', { cache: 'no-store' })
        const json = await res.json()
        setCatalog(json)
      } catch (e) { console.error('Catalog error', e) }
    })()
  }, [])

  const subjects = catalog.subjects || []
  const currentSubject = subjects.find(s => s.id === current.subject) || null
  const chapters = currentSubject?.chapters || []
  const currentChapter = chapters.find(c => c.id === current.chapter) || null
  const currentSubjectId = currentSubject?.id || null
  const currentChapterId = currentChapter?.id || null

  useEffect(() => { if (!current.subject && subjects[0]) setCurrent(s => ({ ...s, subject: subjects[0].id })) }, [subjects])
  useEffect(() => { if (current.subject && !current.chapter && chapters[0]) setCurrent(s => ({ ...s, chapter: chapters[0].id })) }, [current.subject, chapters])

  async function loadChapter(ch) {
    if (!ch) return
    setLoading(true)
    try {
      const res = await fetch(`/data/${ch.file}`, { cache: 'no-store' })
      const text = await res.text()
      const parsed = parseCSV(text)
      setItems(shuffleOn ? shuffle(parsed.items) : parsed.items)
      setWarnings(parsed.warnings || [])
      setAnswers({}); setScore(null)
    } catch (e) {
      console.error('Chapter load error', e)
      setWarnings([`Errore nel caricamento del file: ${ch.file}`])
      setItems([])
    } finally { setLoading(false) }
  }

  useEffect(() => { if (currentChapter) loadChapter(currentChapter) }, [currentChapter?.id, shuffleOn])

  function handleAnswer(idx, optionIndex) { setAnswers(prev => ({ ...prev, [idx]: optionIndex })) }

  function computeScore() {
    let correct = 0
    items.forEach((it, i) => { if (answers[i] === it.answerIndex) correct++ })
    const result = { when: new Date().toISOString(), subject: currentSubject?.name, chapter: currentChapter?.title, subjectId: currentSubjectId, chapterId: currentChapterId, total: items.length, correct }
    setScore(result)
    try {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      prev.unshift(result)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(0, 200)))
      const pct = Math.round((correct / items.length) * 100)
      const map = JSON.parse(localStorage.getItem(CHAPTER_STATS_KEY) || '{}')
      const key = `${currentSubjectId || 'unknown'}|${currentChapterId || 'unknown'}`
      const arr = Array.isArray(map[key]) ? map[key] : []
      arr.unshift({ when: result.when, pct })
      map[key] = arr.slice(0, 100)
      localStorage.setItem(CHAPTER_STATS_KEY, JSON.stringify(map))
    } catch {}
  }

  function resetQuiz() { setAnswers({}); setScore(null); setItems(shuffleOn ? shuffle(items) : items) }

  const allAnswered = useMemo(() => items.every((_, i) => Number.isInteger(answers[i])), [items, answers])

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="header">
        <div className="container header-inner">
          <div className="brand">QuizClass</div>
          <span className="badge">UI avanzata</span>
          <div style={{ marginLeft: 'auto' }} className="controls">
            <button className="btn btn-outline" onClick={() => setMode(m => m === 'practice' ? 'exam' : 'practice')}>
              Modalità: {mode === 'practice' ? 'Pratica' : 'Simulazione'}
            </button>
            <button className="btn btn-outline" onClick={() => setShuffleOn(s => !s)}>
              {shuffleOn ? 'Mescola: ON' : 'Mescola: OFF'}
            </button>
            <div className="sep" />
            <span className="small">Dimensione</span>
            <button className="btn btn-outline" onClick={() => setScale(s => Math.max(0.9, Math.round((s - 0.1)*10)/10))}>A-</button>
            <button className="btn btn-outline" onClick={() => setScale(s => Math.min(1.8, Math.round((s + 0.1)*10)/10))}>A+</button>
            <button className="btn btn-outline" onClick={() => setScale(1.1)}>Reset</button>
            <div className="sep" />
            <span className="small">Tema</span>
            <select className="select" value={theme} onChange={e => setTheme(e.target.value)} style={{ width: 120 }}>
              <option value="auto">Auto</option>
              <option value="light">Chiaro</option>
              <option value="dark">Scuro</option>
            </select>
            <span className="small">Densità</span>
            <select className="select" value={density} onChange={e => setDensity(e.target.value)} style={{ width: 120 }}>
              <option value="comfy">Comodo</option>
              <option value="compact">Compatto</option>
            </select>
            <span className="small">Font</span>
            <select className="select" value={font} onChange={e => setFont(e.target.value)} style={{ width: 160 }}>
              <option value="sans">Sans (di sistema)</option>
              <option value="serif">Serif</option>
              <option value="dys">Dyslexia-friendly</option>
            </select>
            <div className="sep" />
            <label className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={immediate} onChange={e => setImmediate(e.target.checked)} /> Correzioni immediate
            </label>
            <label className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={onlyErrors} onChange={e => setOnlyErrors(e.target.checked)} /> Solo errori dopo consegna
            </label>
            <div className="sep" />
            <span className="small">Soglia (%)</span>
            <input className="input" type="number" min="0" max="100" step="5" value={passThreshold} onChange={e => setPassThreshold(Math.min(100, Math.max(0, Number(e.target.value||0))))} style={{ width: 90 }} />
            <button className="btn btn-outline" onClick={() => loadChapter(currentChapter)}>Ricarica</button>
          </div>
        </div>
      </header>

      <main className="container grid">
        <aside>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Catalogo</div>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 10 }}>
                <select className="select" value={current.subject || ''} onChange={e => setCurrent({ subject: e.target.value, chapter: null })}>
                  <option value="" disabled>Materia</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {currentSubject && (
                <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto', paddingRight: 4 }}>
                  {chapters.map(ch => (
                    <button key={ch.id} onClick={() => setCurrent(curr => ({ ...curr, chapter: ch.id }))}
                      className={'list-btn ' + (current.chapter === ch.id ? 'active' : '')}>
                      <div style={{ fontSize: 'calc(13px * var(--scale))', fontWeight: 700 }}>{ch.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <HistoryPanel />
          <ClassDataPanel />
        </aside>

        <section>
          <div className="card">
            <div className="card-header">
              <div className="card-title">{currentSubject ? currentSubject.name : 'Seleziona una materia'}</div>
              <div className="card-sub">{currentChapter ? currentChapter.title : 'Scegli un capitolo'}</div>
            </div>
            <div className="card-body">
              {loading ? <p>Caricamento…</p> : items.length === 0 ? (
                <p className="small">Nessuna domanda. Aggiungi righe al CSV del capitolo.</p>
              ) : (
                <QuizArea
                  items={items}
                  setItems={setItems}
                  mode={mode}
                  answers={answers}
                  setAnswer={handleAnswer}
                  onSubmit={computeScore}
                  onReset={resetQuiz}
                  score={score}
                  subjectName={currentSubject?.name}
                  chapterTitle={currentChapter?.title}
                  subjectId={currentSubjectId}
                  chapterId={currentChapterId}
                  immediate={immediate}
                  onlyErrors={onlyErrors}
                  passThreshold={passThreshold}
                />
              )}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="card warning-card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title warning-title">Avvisi di validazione CSV</div>
                <div className="card-sub warning-title">Controlla le righe segnalate</div>
              </div>
              <div className="card-body">
                <ul style={{ paddingLeft: 18 }} className="warning-text">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function QuizArea({ items, setItems, mode, answers, setAnswer, onSubmit, onReset, score, subjectName, chapterTitle, subjectId, chapterId, immediate, onlyErrors, passThreshold }) {
  const [started, setStarted] = useState(mode === 'practice')
  useEffect(() => { setStarted(mode === 'practice') }, [mode])
  const allAnswered = useMemo(() => items.every((_, i) => Number.isInteger(answers[i])), [items, answers])

  // Sticky sub-header + progress
  const answeredCount = useMemo(() => items.reduce((n, _it, i) => n + (Number.isInteger(answers[i]) ? 1 : 0), 0), [items, answers])
  const pct = items.length ? Math.round(answeredCount / items.length * 100) : 0

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="sticky-sub">
        <div>
          <div className="sticky-title">{subjectName || 'Materia'}</div>
          <div className="small">{chapterTitle || 'Capitolo'}</div>
        </div>
        <div style={{ minWidth: 260 }}>
          <div className="small" style={{ textAlign: 'right' }}>Risposte: {answeredCount}/{items.length} ({pct}%)</div>
          <div className="progress"><div className="progress-bar" style={{ width: pct + '%' }}/></div>
        </div>
      </div>

      {!started ? (
        <div className="banner">Modalità <b>Simulazione verifica</b>: le correzioni compaiono al termine.
          <button onClick={() => setStarted(true)} className="btn btn-solid" style={{ marginLeft: 8 }}>Inizia</button>
        </div>
      ) : null}

      {started && items.map((it, idx) => (
        <QuestionCard
          key={idx}
          index={idx}
          data={it}
          mode={mode}
          selected={answers[idx]}
          setSelected={(v) => setAnswer(idx, v)}
          reveal={Boolean(score) || (immediate && Number.isInteger(answers[idx]))}
          onlyErrors={onlyErrors}
          hasSubmitted={Boolean(score)}
        />
      ))}

      {started && (
        <div className="controls">
          <button onClick={onReset} className="btn btn-outline">Reset</button>
          <button onClick={onSubmit} className="btn btn-solid" disabled={!allAnswered}>Consegna</button>
        </div>
      )}

      {score && (
        <div className="card" style={{ border: '1px solid #86efac' }}>
          <div className="card-header">
            <div className="card-title">Risultato</div>
            <div className="card-sub">{new Date(score.when).toLocaleString()}</div>
          </div>
          <div className="card-body" style={{ fontSize: 'calc(14px * var(--scale))' }}>
            {(() => {
              const spct = Math.round(score.correct/score.total*100)
              const pass = spct >= passThreshold
              // Percentile vs class or local
              let percentileText = null
              try {
                const classArr = JSON.parse(localStorage.getItem(CLASS_DATA_KEY) || '[]')
                const map = JSON.parse(localStorage.getItem(CHAPTER_STATS_KEY) || '{}')
                const key = `${subjectId || 'unknown'}|${chapterId || 'unknown'}`
                const localArr = Array.isArray(map[key]) ? map[key] : []
                const ref = classArr.filter(x => x.subjectId===subjectId && x.chapterId===chapterId).map(x => x.pct)
                const base = ref.length ? ref : localArr.map(x => x.pct)
                if (base.length) {
                  const rank = Math.round((base.filter(v => v <= spct).length / base.length) * 100)
                  percentileText = `Percentile (classe): ${rank}°` + (ref.length ? '' : ' (confronto locale)')
                }
              } catch {}
              return (
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span>Punteggio: <b>{score.correct}/{score.total}</b> ({spct}%)</span>
                  <span className={'result-badge ' + (pass ? 'pass' : 'fail')}>
                    {pass ? 'Superato' : 'Non superato'} (≥ {passThreshold}%)
                  </span>
                  {percentileText ? <span className="small">{percentileText}</span> : null}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {score && (() => {
        const wrong = items.map((_,i)=>i).filter(i => answers[i] !== items[i].answerIndex)
        if (!wrong.length) return null
        return (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-header">
              <div className="card-title">Riepilogo errori</div>
              <div className="card-sub">{wrong.length} domanda/e da rivedere</div>
            </div>
            <div className="card-body" style={{ display:'grid', gap:8 }}>
              <button className="btn btn-solid" onClick={() => {
                const next = wrong.map(i => items[i])
                window.scrollTo({ top: 0, behavior: 'smooth' })
                setAnswer(() => ({}))
                onReset()
                setItems(next)
              }}>Riprova solo errori</button>
              <ul style={{ paddingLeft: 18 }}>
                {wrong.map((i) => (
                  <li key={i}><b>Domanda {i+1}:</b> {items[i].question}</li>
                ))}
              </ul>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function QuestionCard({ index, data, selected, setSelected, mode, reveal, onlyErrors, hasSubmitted }) {
  const isCorrect = Number.isInteger(selected) && selected === data.answerIndex
  return (
    <div className="card" style={{ border: reveal && Number.isInteger(selected) ? (isCorrect ? '1px solid #86efac' : '1px solid #fca5a5') : '1px solid var(--border)' }}>
      <div className="card-header">
        <div className="card-title">Domanda {index + 1}</div>
        <div className="card-sub question">{data.question}</div>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 8 }}>
        {data.options.map((opt, i) => {
          const chosen = selected === i
          const showRight = reveal && i === data.answerIndex && !(onlyErrors && hasSubmitted)
          const showWrong = reveal && chosen && i !== data.answerIndex
          const extraClass = (showRight && mode === 'practice') ? 'correct-glow' : ''
          return (
            <button key={i} onClick={() => setSelected(i)} className={'option ' + (chosen ? 'active' : '') + ' ' + extraClass}>
              <span className="badge-round">{String.fromCharCode(65 + i)}</span>
              <span style={{ fontSize: 'calc(16px * var(--scale))' }}>{opt}</span>
              {showRight && <span className="right">✓</span>}
              {showWrong && <span className="wrong">✕</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HistoryPanel() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])
  useEffect(() => { try { setEntries(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {} }, [open])
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Storico punteggi</div>
        <button onClick={() => setOpen(o => !o)} className="btn btn-outline">{open ? 'Nascondi' : 'Mostra'}</button>
      </div>
      {open && (
        <div className="card-body">
          {!entries.length ? <p className="small">Nessun risultato salvato.</p> : (
            <ul style={{ display: 'grid', gap: 8 }}>
              {entries.map((e, i) => (
                <li key={i} className="list-btn">
                  <div style={{ fontWeight: 700 }}>{e.subject} — {e.chapter}</div>
                  <div className="small">{new Date(e.when).toLocaleString()}</div>
                  <div style={{ marginLeft: 'auto' }}><b>{e.correct}/{e.total}</b></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ClassDataPanel() {
  const [imported, setImported] = useState(false)
  function onUpload(e){
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader()
    reader.onload = () => { try { const data = JSON.parse(reader.result); localStorage.setItem(CLASS_DATA_KEY, JSON.stringify(data)); setImported(true) } catch {} }
    reader.readAsText(f)
  }
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-header">
        <div className="card-title">Dati classe (opzionale)</div>
        <div className="card-sub">Importa un JSON di punteggi per percentile</div>
      </div>
      <div className="card-body">
        <input className="input" type="file" accept="application/json" onChange={onUpload} />
        {imported ? <p className="small">Dati classe caricati!</p> : <p className="small">Formato: array di oggetti {"{subjectId, chapterId, pct}" }.</p>}
      </div>
    </div>
  )
}
