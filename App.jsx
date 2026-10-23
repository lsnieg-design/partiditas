import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, History, Trophy, Spade, Settings2, ArrowLeft, RotateCcw, Minus, PlusCircle, NotebookPen, LoaderCircle, Gamepad2 } from 'lucide-react';
import { api } from './api.js';

const GAMES = [
  { id: 'chinchon', name: 'Chinchón', emoji: '🃏', color: 'yellow', description: 'Rondas y puntos acumulados' },
  { id: 'escoba', name: 'Escoba de 15', emoji: '🧹', color: 'pink', description: 'Anotá los tantos de cada mano' },
  { id: 'truco', name: 'Truco', emoji: '♠', color: 'green', description: 'Tantos por equipo o jugador' },
  { id: 'rummy', name: 'Rummy', emoji: '♦', color: 'purple', description: 'Puntos y rondas' },
  { id: 'libre', name: 'Contador libre', emoji: '🎲', color: 'blue', description: 'Sumá o restá cualquier puntaje' }
];
const DEFAULT_RULES = {
  chinchon: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true },
  escoba: { target: 15, direction: 'higher', unit: 'tantos', roundBased: true },
  truco: { target: 30, direction: 'higher', unit: 'tantos', roundBased: true },
  rummy: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true },
  libre: { target: 0, direction: 'higher', unit: 'puntos', roundBased: true }
};
const blankGroup = { name: '', accessCode: '' };

export default function App() {
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [screen, setScreen] = useState('home');
  const [groupForm, setGroupForm] = useState(blankGroup);
  const [joinCode, setJoinCode] = useState('');
  const [joinAccessCode, setJoinAccessCode] = useState('');
  const [gameForm, setGameForm] = useState({ gameId: 'chinchon', players: ['', ''], title: '' });
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [roundNote, setRoundNote] = useState('');
  const [roundScores, setRoundScores] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { refreshGroups(); }, []);
  async function refreshGroups() {
    setBusy(true); setError('');
    try { const data = await api('listGroups'); setGroups(data.groups || []); }
    catch (e) { setError(`${e.message} Si todavía no configuraste Apps Script, seguí los pasos del README.`); }
    finally { setBusy(false); setLoaded(true); }
  }
  async function openGroup(g) {
    let accessCode = g.accessCode || '';
    if (g.requiresKey && !accessCode) { accessCode = window.prompt('Esta mesa tiene clave. Ingresala para entrar:') || ''; if (!accessCode) return; }
    setBusy(true); setError('');
    try {
      const data = await api('getGroup', { groupId: g.id, accessCode });
      setGroup({ ...data.group, accessCode }); setHistory(data.games || []); setScreen('group');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function createGroup(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api('createGroup', { name: groupForm.name.trim(), accessCode: groupForm.accessCode.trim() });
      const created = { ...data.group, accessCode: groupForm.accessCode.trim() };
      setGroup(created); setGroups(prev => [...prev, { id: created.id, name: created.name }]); setHistory([]); setGroupForm(blankGroup); setScreen('group');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function joinGroup(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api('getGroup', { groupId: joinCode.trim(), accessCode: joinAccessCode.trim() });
      setGroup({ ...data.group, accessCode: joinAccessCode.trim() }); setHistory(data.games || []); setJoinCode(''); setJoinAccessCode(''); setScreen('group');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function addPlayer() { setGameForm(f => ({ ...f, players: [...f.players, ''] })); }
  function setPlayer(i, value) { setGameForm(f => ({ ...f, players: f.players.map((p, j) => i === j ? value : p) })); }
  async function startGame(e) {
    e.preventDefault();
    const players = gameForm.players.map(x => x.trim()).filter(Boolean);
    if (players.length < 2) { setError('Agregá al menos dos jugadores.'); return; }
    setBusy(true); setError('');
    try {
      const game = GAMES.find(g => g.id === gameForm.gameId);
      const data = await api('createGame', { groupId: group.id, accessCode: group.accessCode || '', gameId: game.id, gameName: game.name, title: gameForm.title.trim() || `${game.name} — ${new Date().toLocaleDateString('es-AR')}`, players, rules: rules[game.id] });
      setActiveGame(data.game); setRoundScores(Object.fromEntries(players.map(p => [p, 0]))); setRoundNote(''); setScreen('play');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function addRound() {
    if (!activeGame) return;
    setBusy(true); setError('');
    try {
      const data = await api('addRound', { groupId: group.id, accessCode: group.accessCode || '', gameId: activeGame.id, scores: roundScores, note: roundNote });
      setActiveGame(data.game); setRoundScores(Object.fromEntries(activeGame.players.map(p => [p.name, 0]))); setRoundNote(''); setMessage('Puntajes guardados en Google Sheets.'); setTimeout(() => setMessage(''), 2500);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function finishGame() {
    if (!activeGame) return;
    setBusy(true); setError('');
    try { await api('finishGame', { groupId: group.id, accessCode: group.accessCode || '', gameId: activeGame.id }); await openGroup(group); setActiveGame(null); setScreen('group'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function updateRule(gameId, key, value) {
    const next = { ...rules, [gameId]: { ...rules[gameId], [key]: value } }; setRules(next);
    if (group) {
      try { await api('saveRules', { groupId: group.id, accessCode: group.accessCode || '', rules: next }); }
      catch (e) { setError(`No se pudieron guardar las reglas: ${e.message}`); }
    }
  }
  const selectedGame = GAMES.find(g => g.id === gameForm.gameId) || GAMES[0];
  const totals = useMemo(() => {
    const out = {};
    (activeGame?.players || []).forEach(p => { out[p.name] = (activeGame.rounds || []).reduce((sum, r) => sum + (Number(r.scores?.[p.name]) || 0), 0); });
    return out;
  }, [activeGame]);
  const ranking = useMemo(() => Object.entries(totals).sort((a,b) => (activeGame?.rules?.direction === 'lower' ? a[1]-b[1] : b[1]-a[1])), [totals, activeGame]);

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => { setScreen(group ? 'group' : 'home'); setError(''); }}><span className="brand-mark">✳</span><span>partiditas<small>tu libreta de juegos</small></span></button><span className="top-note">hecho para jugar juntxs <span>♥</span></span></header>
    {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar">×</button></div>}
    {message && <div className="alert success">{message}</div>}
    {busy && <div className="busy"><LoaderCircle size={16} className="spin"/> Guardando…</div>}

    {screen === 'home' && <>
      <section className="hero"><div><span className="eyebrow">LA MESA ESTÁ LISTA</span><h1>Una partida más.<br/><em>Y otra también.</em></h1><p>Creá una mesa para tu grupo, anotá los tantos y que la memoria la tenga la app.</p></div><div className="hero-doodle" aria-hidden="true"><div className="doodle-card yellow">¿Quién<br/>va ganando?</div><div className="doodle-card pink">¡Dale<br/>revancha!</div><span>✦</span></div></section>
      <section className="section-head"><div><span className="eyebrow">EMPEZAR</span><h2>Tus mesas de juego</h2></div><span className="count-pill">{groups.length} {groups.length === 1 ? 'mesa' : 'mesas'}</span></section>
      <div className="group-grid">{groups.map((g, i) => <button className={`group-card note-${i%4}`} key={g.id} onClick={() => openGroup(g)}><span className="pin">✦</span><span className="card-kicker">MESA DE JUEGO</span><strong>{g.name}</strong><span className="card-bottom"><Users size={15}/> Abrir mesa <span>↗</span></span></button>)}
        <form className="create-card" onSubmit={createGroup}><div className="plus-bubble"><Plus size={21}/></div><h3>Crear una mesa</h3><p>Un grupo independiente, con su propio historial.</p><label>Nombre del grupo<input required maxLength="60" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Ej. Los del domingo"/></label><label>Clave de acceso (opcional)<input value={groupForm.accessCode} onChange={e => setGroupForm({ ...groupForm, accessCode: e.target.value })} placeholder="Una clave para esta mesa" autoComplete="new-password"/></label><button className="button primary" disabled={busy}>Crear mesa <span>→</span></button></form>
      </div>
      <form className="join-strip" onSubmit={joinGroup}><div className="join-icon"><Users size={21}/></div><div><strong>¿Te compartieron el ID de una mesa?</strong><p>Ingresalo para abrir su historial.</p></div><input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="ID de la mesa" required/><input value={joinAccessCode} onChange={e => setJoinAccessCode(e.target.value)} placeholder="Clave (si tiene)"/><button className="button secondary">Entrar</button></form>
      <p className="privacy-note"><NotebookPen size={15}/> Las partidas se guardan en Google Sheets, no en el almacenamiento del navegador.</p>
    </>}

    {screen === 'group' && group && <>
      <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Todas las mesas</button>
      <section className="group-banner"><div><span className="eyebrow">TU MESA</span><h1>{group.name}</h1><p>Un espacio para sumar puntos, anécdotas y revancha.</p><div className="group-id">ID para compartir: <code>{group.id}</code><button onClick={() => navigator.clipboard?.writeText(group.id)} title="Copiar ID">Copiar</button></div></div><div className="banner-stamp">QUE<br/>GANE<br/>EL MEJOR</div></section>
      <div className="action-row"><div><span className="eyebrow">¿QUÉ JUGAMOS?</span><h2>Elegí tu juego</h2></div><button className="button secondary" onClick={() => setScreen('rules')}><Settings2 size={16}/> Reglas</button></div>
      <div className="game-grid">{GAMES.map(g => <button className={`game-card ${g.color}`} key={g.id} onClick={() => { setGameForm({ gameId: g.id, players: ['', ''], title: '' }); setScreen('newgame'); }}><span className="game-emoji">{g.emoji}</span><strong>{g.name}</strong><small>{g.description}</small><span className="game-arrow">↗</span></button>)}</div>
      <section className="history-section"><div className="section-head"><div><span className="eyebrow">LOS RECUERDOS</span><h2>Historial de partidas</h2></div><span className="count-pill">{history.length} partidas</span></div>{history.length ? <div className="history-list">{history.map((g, i) => <div className="history-item" key={g.id}><div className={`history-icon note-${i%4}`}>{GAMES.find(x => x.id === g.gameId)?.emoji || '🎲'}</div><div className="history-main"><strong>{g.title || g.gameName}</strong><span>{g.gameName} · {(g.players || []).map(p => p.name).join(', ')}</span><small>{g.finishedAt ? `Finalizada · ${new Date(g.finishedAt).toLocaleDateString('es-AR')}` : 'En curso'}</small></div><div className="history-score">{g.winner ? <><Trophy size={15}/><span>{g.winner}</span></> : <span className="in-progress">En juego</span>}</div></div>)}</div> : <div className="empty-state"><span>🗒️</span><strong>Acá van a quedar las partidas</strong><p>Cuando terminen de jugar, vas a poder volver a ver los resultados.</p></div>}</section>
    </>}

    {screen === 'newgame' && group && <>
      <button className="back-link" onClick={() => setScreen('group')}><ArrowLeft size={16}/> Volver a la mesa</button><section className="form-panel"><span className="eyebrow">NUEVA PARTIDA</span><h1>Armemos la mesa.</h1><p>Unos datos rápidos y ya pueden empezar.</p><form onSubmit={startGame}><label>Juego<select value={gameForm.gameId} onChange={e => setGameForm({ ...gameForm, gameId: e.target.value })}>{GAMES.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label><label>Nombre de la partida (opcional)<input value={gameForm.title} onChange={e => setGameForm({ ...gameForm, title: e.target.value })} placeholder="Ej. Final del campeonato"/></label><div className="players-head"><label>Jugadores <small>mínimo 2</small></label><button type="button" className="text-button" onClick={addPlayer}><Plus size={15}/> Agregar jugador</button></div><div className="player-fields">{gameForm.players.map((p,i) => <div className="player-field" key={i}><span>{String(i+1).padStart(2,'0')}</span><input value={p} onChange={e => setPlayer(i,e.target.value)} placeholder={`Nombre de jugador/a ${i+1}`} required/><button type="button" title="Quitar jugador" disabled={gameForm.players.length<=2} onClick={() => setGameForm(f => ({ ...f, players: f.players.filter((_,j) => j!==i) }))}>×</button></div>)}</div><div className="rule-summary"><Settings2 size={17}/><span><strong>Reglas actuales:</strong> {rules[selectedGame.id].direction === 'lower' ? 'gana el puntaje más bajo' : 'gana el puntaje más alto'}{rules[selectedGame.id].target ? ` · objetivo ${rules[selectedGame.id].target} ${rules[selectedGame.id].unit}` : ''}</span><button type="button" onClick={() => setScreen('rules')}>Editar</button></div><button className="button primary wide" disabled={busy}>Empezar partida <span>→</span></button></form></section>
    </>}

    {screen === 'play' && activeGame && <>
      <button className="back-link" onClick={() => setScreen('group')}><ArrowLeft size={16}/> Volver a la mesa</button><section className="play-heading"><span className="eyebrow">PARTIDA EN CURSO · {activeGame.gameName}</span><h1>{activeGame.title}</h1><p>Los puntajes se guardan en la planilla cuando agregás una ronda.</p></section>
      <div className="scoreboard"><div className="scoreboard-head"><h2><Trophy size={20}/> Marcador</h2><span>{(activeGame.rounds || []).length} rondas</span></div>{ranking.map(([name,score],i) => <div className={`score-row ${i===0?'leader':''}`} key={name}><span className="rank">{i===0?'✦':String(i+1).padStart(2,'0')}</span><strong>{name}</strong><span className="total-score">{score}</span></div>)}</div>
      <section className="round-panel"><span className="eyebrow">SIGUIENTE RONDA</span><h2>Anotá los puntos</h2><p>Usá valores negativos si necesitás restar puntos.</p><div className="round-inputs">{activeGame.players.map((p,i) => <label key={p.id || p.name}><span>{p.name}</span><div className="number-stepper"><button type="button" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name])||0)-1 }))}><Minus size={16}/></button><input type="number" value={roundScores[p.name] ?? 0} onChange={e => setRoundScores(s => ({ ...s, [p.name]: e.target.value }))}/><button type="button" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name])||0)+1 }))}><Plus size={16}/></button></div></label>)}</div><label>Nota de la ronda (opcional)<input value={roundNote} onChange={e => setRoundNote(e.target.value)} placeholder="Ej. flor, escoba, cierre…"/></label><button className="button primary wide" onClick={addRound} disabled={busy}><PlusCircle size={17}/> Guardar ronda</button></section>
      {(activeGame.rounds || []).length > 0 && <section className="round-history"><h2>Rondas anteriores</h2>{activeGame.rounds.map((r,i) => <div className="round-line" key={r.id || i}><span>Ronda {i+1}{r.note ? ` · ${r.note}` : ''}</span><span>{activeGame.players.map(p => `${p.name}: ${r.scores?.[p.name] ?? 0}`).join('  /  ')}</span></div>)}</section>}
      <button className="button finish-button" onClick={finishGame} disabled={busy}><Trophy size={17}/> Finalizar partida</button>
    </>}

    {screen === 'rules' && <><button className="back-link" onClick={() => setScreen(group ? 'group' : 'home')}><ArrowLeft size={16}/> Volver</button><section className="form-panel rules-panel"><span className="eyebrow">PERSONALIZÁ</span><h1>Las reglas de la mesa.</h1><p>Configurá el objetivo y cómo se determina quién gana para cada juego.</p>{GAMES.map(g => <div className="rule-card" key={g.id}><div className="rule-title"><span>{g.emoji}</span><strong>{g.name}</strong></div><label>¿Cómo se gana?<select value={rules[g.id].direction} onChange={e => updateRule(g.id,'direction',e.target.value)}><option value="higher">Gana el puntaje más alto</option><option value="lower">Gana el puntaje más bajo</option></select></label><div className="rule-two"><label>Objetivo (0 = sin objetivo)<input type="number" value={rules[g.id].target} onChange={e => updateRule(g.id,'target',Number(e.target.value))}/></label><label>Nombre del puntaje<input value={rules[g.id].unit} onChange={e => updateRule(g.id,'unit',e.target.value)} placeholder="puntos, tantos…"/></label></div></div>)}<button className="button primary wide" onClick={() => setScreen(group ? 'group' : 'home')}>Listo, volver <span>→</span></button></section></>}
    <footer><span>✳ partiditas</span><span>Las mejores partidas no se olvidan.</span></footer>
  </main>;
}
