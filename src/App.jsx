import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, History, Trophy, Settings2, ArrowLeft, Minus, PlusCircle, NotebookPen, LoaderCircle, Check, Undo2, RotateCcw, Download, Smartphone, Share, X, Pencil, Trash2 } from 'lucide-react';
import { api } from './api.js';

const GAMES = [
  { id: 'chinchon', name: 'Chinchón', emoji: '🃏', color: 'yellow', description: 'Puntos de penalización por ronda' },
  { id: 'escoba', name: 'Escoba de 15', emoji: '🧹', color: 'pink', description: 'Escobas, cartas y oros' },
  { id: 'truco', name: 'Truco', emoji: '♠', color: 'green', description: 'Marcador de buenas y malas' },
  { id: 'rummy', name: 'Rummy', emoji: '♦', color: 'purple', description: 'Puntos de las cartas que quedan' },
  { id: 'libre', name: 'Contador libre', emoji: '🎲', color: 'blue', description: 'Sumá o restá a tu manera' }
];
const DEFAULT_RULES = {
  chinchon: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true, chinchonBonus: 10, endAtTarget: true },
  escoba: { target: 15, direction: 'higher', unit: 'tantos', roundBased: true, scoringMode: 'escoba-15', pointsPerEscoba: 1, pointsPerCategory: 1 },
  truco: { target: 30, direction: 'higher', unit: 'tantos', roundBased: true, scoringMode: 'truco-teams', splitAt: 15 },
  rummy: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true, scoringMode: 'card-penalties' },
  libre: { target: 0, direction: 'higher', unit: 'puntos', roundBased: true }
};
const blankGroup = { name: '', accessCode: '' };
const mergeRules = (saved = {}) => Object.fromEntries(Object.keys(DEFAULT_RULES).map(id => [id, { ...DEFAULT_RULES[id], ...(saved?.[id] || {}) }]));
const blankPlayers = () => ['', ''];

export default function App() {
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [screen, setScreen] = useState('home');
  const [groupForm, setGroupForm] = useState(blankGroup);
  const [joinCode, setJoinCode] = useState('');
  const [joinAccessCode, setJoinAccessCode] = useState('');
  const [gameForm, setGameForm] = useState({ gameId: 'chinchon', players: blankPlayers(), title: '' });
  const [teamSetup, setTeamSetup] = useState({ names: ['Nosotros', 'Ellos'], members: ['', ''] });
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [ruleGameId, setRuleGameId] = useState('chinchon');
  const [ruleDraft, setRuleDraft] = useState(null);
  const [ruleReturnTo, setRuleReturnTo] = useState('rules');
  const [roundNote, setRoundNote] = useState('');
  const [roundScores, setRoundScores] = useState({});
  const [escobaAwards, setEscobaAwards] = useState({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' });
  const [chinchonPlayer, setChinchonPlayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [installTab, setInstallTab] = useState('android');
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);

  useEffect(() => { refreshGroups(); }, []);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setInstallTab(isAppleMobile ? 'iphone' : 'android');

    const handleBeforeInstallPrompt = (event) => {
      // Conserva la invitación nativa de Chrome/Android para mostrarla desde el botón.
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setShowInstallHelp(false);
      setMessage('¡Partiditas quedó instalada en tu dispositivo!');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  function openInstallHelp() {
    const ua = window.navigator.userAgent || '';
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setInstallTab(isAppleMobile ? 'iphone' : 'android');
    setShowInstallHelp(true);
  }

  async function installOnAndroid() {
    if (!deferredInstallPrompt) return;
    const installPrompt = deferredInstallPrompt;
    setDeferredInstallPrompt(null);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setShowInstallHelp(false);
        setMessage('¡Partiditas se está instalando en tu dispositivo!');
      }
    } catch (e) {
      setError('No se pudo abrir la instalación automática. Seguí los pasos de Chrome para agregar Partiditas a la pantalla de inicio.');
    }
  }
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
      setGroup({ ...data.group, accessCode }); setHistory(data.games || []); setRules(mergeRules(data.group?.rules)); setScreen('group');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function createGroup(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api('createGroup', { name: groupForm.name.trim(), accessCode: groupForm.accessCode.trim() });
      const created = { ...data.group, accessCode: groupForm.accessCode.trim() };
      setGroup(created); setGroups(prev => [...prev, { id: created.id, name: created.name }]); setHistory([]); setRules(mergeRules(data.group?.rules)); setGroupForm(blankGroup); setScreen('group');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function editGroup(g) {
    const proposedName = window.prompt('¿Cómo querés llamar a esta mesa?', g.name || '');
    if (proposedName === null) return;
    const name = proposedName.trim();
    if (!name) {
      setError('El nombre de la mesa no puede quedar vacío.');
      return;
    }
    if (name.length > 60) {
      setError('El nombre de la mesa puede tener hasta 60 caracteres.');
      return;
    }

    let accessCode = group?.id === g.id ? (group.accessCode || '') : '';
    if (g.requiresKey && !accessCode) {
      const entered = window.prompt(`La mesa “${g.name}” tiene clave. Ingresala para editarla:`);
      if (entered === null) return;
      accessCode = entered.trim();
      if (!accessCode) {
        setError('Necesitás ingresar la clave de esta mesa para editarla.');
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      const data = await api('updateGroup', { groupId: g.id, accessCode, name });
      setGroups(prev => prev.map(item => item.id === g.id ? { ...item, name: data.group?.name || name } : item));
      if (group?.id === g.id) setGroup(prev => prev ? { ...prev, name: data.group?.name || name, accessCode: accessCode || prev.accessCode || '' } : prev);
      setMessage(`Mesa actualizada: ${data.group?.name || name}.`);
      setTimeout(() => setMessage(''), 2600);
    } catch (e) {
      setError(`No se pudo editar la mesa: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(g) {
    const confirmed = window.confirm(
      `¿Eliminar la mesa “${g.name}”?\n\nTambién se eliminarán sus partidas, rondas, resultados e historial. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    let accessCode = group?.id === g.id ? (group.accessCode || '') : '';
    if (g.requiresKey && !accessCode) {
      const entered = window.prompt(`La mesa “${g.name}” tiene clave. Ingresala para eliminarla:`);
      if (entered === null) return;
      accessCode = entered.trim();
      if (!accessCode) {
        setError('Necesitás ingresar la clave de esta mesa para eliminarla.');
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      await api('deleteGroup', { groupId: g.id, accessCode });
      setGroups(prev => prev.filter(item => item.id !== g.id));
      if (group?.id === g.id) {
        setGroup(null);
        setHistory([]);
        setActiveGame(null);
        setScreen('home');
        setRules(DEFAULT_RULES);
      }
      setMessage(`Se eliminó la mesa “${g.name}” y su historial.`);
      setTimeout(() => setMessage(''), 3200);
    } catch (e) {
      setError(`No se pudo eliminar la mesa: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api('getGroup', { groupId: joinCode.trim(), accessCode: joinAccessCode.trim() });
      setGroup({ ...data.group, accessCode: joinAccessCode.trim() }); setHistory(data.games || []); setRules(mergeRules(data.group?.rules)); setJoinCode(''); setJoinAccessCode(''); setScreen('group');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function addPlayer() { setGameForm(f => ({ ...f, players: [...f.players, ''] })); }
  function setPlayer(i, value) { setGameForm(f => ({ ...f, players: f.players.map((p, j) => i === j ? value : p) })); }
  function chooseGame(id) {
    setGameForm({ gameId: id, players: id === 'truco' ? blankPlayers() : blankPlayers(), title: '' });
    setTeamSetup({ names: ['Nosotros', 'Ellos'], members: ['', ''] });
  }
  async function startGame(e) {
    e.preventDefault();
    const selected = GAMES.find(g => g.id === gameForm.gameId) || GAMES[0];
    let players;
    let gameRules = { ...rules[selected.id] };
    if (selected.id === 'truco') {
      const teamNames = teamSetup.names.map((n, i) => n.trim() || (i === 0 ? 'Nosotros' : 'Ellos'));
      if (teamNames[0].toLocaleLowerCase() === teamNames[1].toLocaleLowerCase()) { setError('Los dos equipos necesitan nombres diferentes.'); return; }
      players = teamNames;
      gameRules.teamMode = true;
      gameRules.teamMembers = Object.fromEntries(teamNames.map((name, i) => [name, teamSetup.members[i].split(',').map(n => n.trim()).filter(Boolean)]));
    } else {
      players = gameForm.players.map(x => x.trim()).filter(Boolean);
      if (players.length < 2) { setError('Agregá al menos dos jugadores.'); return; }
      if (new Set(players.map(p => p.toLocaleLowerCase())).size !== players.length) { setError('Cada jugador necesita un nombre diferente para no mezclar los puntajes.'); return; }
    }
    setBusy(true); setError('');
    try {
      const data = await api('createGame', { groupId: group.id, accessCode: group.accessCode || '', gameId: selected.id, gameName: selected.name, title: gameForm.title.trim() || `${selected.name} — ${new Date().toLocaleDateString('es-AR')}`, players, rules: gameRules });
      setActiveGame(data.game); setRoundScores(Object.fromEntries(players.map(p => [p, 0]))); setRoundNote(''); setEscobaAwards({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' }); setChinchonPlayer(''); setScreen('play');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function addRound() {
    if (!activeGame) return;
    let scores = Object.fromEntries(activeGame.players.map(p => [p.name, Number(roundScores[p.name]) || 0]));
    let note = roundNote.trim();
    if (activeGame.gameId === 'escoba') {
      const awardNames = { masCartas: 'Más cartas', masOros: 'Más oros', sieteOro: 'Siete de oros', masSietes: 'Más sietes' };
      const pointsPerEscoba = Math.max(0, Number(activeGame.rules?.pointsPerEscoba ?? 1));
      const pointsPerCategory = Math.max(0, Number(activeGame.rules?.pointsPerCategory ?? 1));
      Object.entries(scores).forEach(([name, val]) => {
        const escobas = Number(val) || 0;
        if (escobas) note = [note, `${name}: ${escobas} escoba(s)`].filter(Boolean).join(' · ');
        scores[name] = escobas * pointsPerEscoba;
      });
      Object.entries(escobaAwards).forEach(([key, winner]) => {
        if (winner && Object.hasOwn(scores, winner)) {
          scores[winner] += pointsPerCategory;
          note = [note, `${awardNames[key]}: ${winner} (+${pointsPerCategory})`].filter(Boolean).join(' · ');
        }
      });
    }
    if (activeGame.gameId === 'chinchon' && chinchonPlayer) {
      const bonus = Math.abs(Number(activeGame.rules?.chinchonBonus ?? 10));
      scores[chinchonPlayer] = (scores[chinchonPlayer] || 0) - bonus;
      note = [note, `Chinchón de ${chinchonPlayer} (-${bonus} puntos)`].filter(Boolean).join(' · ');
    }
    if (activeGame.gameId === 'truco' && !Object.values(scores).some(n => n !== 0)) { setError('Sumá o restá tantos antes de guardar el marcador.'); return; }
    setBusy(true); setError('');
    try {
      const data = await api('addRound', { groupId: group.id, accessCode: group.accessCode || '', gameId: activeGame.id, scores, note });
      setActiveGame(data.game); setRoundScores(Object.fromEntries(activeGame.players.map(p => [p.name, 0]))); setRoundNote(''); setEscobaAwards({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' }); setChinchonPlayer(''); setMessage('Puntajes guardados en Google Sheets.'); setTimeout(() => setMessage(''), 2500);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function finishGame() {
    if (!activeGame) return;
    setBusy(true); setError('');
    try {
      await api('finishGame', { groupId: group.id, accessCode: group.accessCode || '', gameId: activeGame.id });
      const data = await api('getGroup', { groupId: group.id, accessCode: group.accessCode || '' });
      setGroup({ ...data.group, accessCode: group.accessCode || '' }); setHistory(data.games || []); setActiveGame(null); setScreen('group');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function openRuleEditor(gameId, returnTo = 'rules') {
    setRuleGameId(gameId);
    setRuleDraft({ ...(rules[gameId] || DEFAULT_RULES[gameId]) });
    setRuleReturnTo(returnTo);
    setError('');
    setScreen('rule-editor');
  }
  function changeRuleDraft(key, value) {
    setRuleDraft(current => ({ ...(current || rules[ruleGameId] || DEFAULT_RULES[ruleGameId]), [key]: value }));
  }
  async function saveRuleEditor() {
    if (!ruleDraft) return;
    const next = { ...rules, [ruleGameId]: { ...ruleDraft } };
    setBusy(true); setError('');
    try {
      if (group) await api('saveRules', { groupId: group.id, accessCode: group.accessCode || '', rules: next });
      setRules(next);
      const label = GAMES.find(g => g.id === ruleGameId)?.name || 'Juego';
      setMessage(`Reglas de ${label} guardadas.`);
      setTimeout(() => setMessage(''), 2600);
      setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules');
    } catch (e) {
      setError(`No se pudieron guardar las reglas: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }
  const selectedGame = GAMES.find(g => g.id === gameForm.gameId) || GAMES[0];
  const ruleGame = GAMES.find(g => g.id === ruleGameId) || GAMES[0];
  const ruleValues = ruleDraft || rules[ruleGame.id] || DEFAULT_RULES[ruleGame.id];
  const totals = useMemo(() => {
    const out = {};
    (activeGame?.players || []).forEach(p => { out[p.name] = (activeGame.rounds || []).reduce((sum, r) => sum + (Number(r.scores?.[p.name]) || 0), 0); });
    return out;
  }, [activeGame]);
  const ranking = useMemo(() => Object.entries(totals).sort((a,b) => (activeGame?.rules?.direction === 'lower' ? a[1]-b[1] : b[1]-a[1])), [totals, activeGame]);
  const shownTruco = (name) => (Number(totals[name]) || 0) + (Number(roundScores[name]) || 0);
  const trucoTarget = Math.max(2, Number(activeGame?.rules?.target) || 30);
  const trucoSplit = Math.min(trucoTarget - 1, Math.max(1, Number(activeGame?.rules?.splitAt) || Math.floor(trucoTarget / 2)));
  
  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => { setScreen(group ? 'group' : 'home'); setError(''); }} aria-label="Ir al inicio de Partiditas"><img className="brand-logo" src="/logo.png" alt=""/><span>partiditas<small>tu libreta de juegos</small></span></button><div className="topbar-actions"><button type="button" className="install-cta" onClick={openInstallHelp}><Download size={16}/> DESCARGÁ LA APP</button><a className="top-note" href="https://www.somosnomade.com.ar/" target="_blank" rel="noreferrer">hecho para jugar juntxs por <strong>NÓMADE</strong> <span>♥</span></a></div></header>
    {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar">×</button></div>}
    {message && <div className="alert success">{message}</div>}
    {busy && <div className="busy"><LoaderCircle size={16} className="spin"/> Guardando…</div>}

    {screen === 'home' && <>
      <section className="hero"><div><span className="eyebrow">LA MESA ESTÁ LISTA</span><h1>Una partida más.<br/><em>Y otra también.</em></h1><p>Creá una mesa para tu grupo, anotá los tantos y que la memoria la tenga la app.</p></div><div className="hero-doodle" aria-hidden="true"><div className="doodle-card yellow">¿Quién<br/>va ganando?</div><div className="doodle-card pink">¡Dale<br/>revancha!</div><span>✦</span></div></section>
      <section className="section-head home-section-head"><div><span className="eyebrow">EMPEZAR</span><h2>Tus mesas de juego</h2><p className="section-subtitle">Cada grupo tiene su propio historial y sus reglas.</p></div><div className="home-section-actions"><span className="count-pill">{groups.length} {groups.length === 1 ? 'mesa' : 'mesas'}</span><button type="button" className="button primary new-table-button" onClick={() => { setGroupForm(blankGroup); setError(''); setScreen('newgroup'); }}><Plus size={17}/> NUEVA MESA</button></div></section>
      {groups.length ? <div className="group-grid">{groups.map((g, i) => <article className={`group-card note-${i%4}`} key={g.id}>
        <button type="button" className="group-card-open" onClick={() => openGroup(g)} aria-label={`Abrir mesa ${g.name}`} disabled={busy}>
          <span className="pin">✦</span><span className="card-kicker">MESA DE JUEGO</span><strong>{g.name}</strong><span className="card-bottom"><Users size={15}/> Abrir mesa <span>↗</span></span>
        </button>
        <div className="group-card-actions" aria-label={`Acciones para ${g.name}`}>
          <button type="button" onClick={() => editGroup(g)} title={`Editar mesa ${g.name}`} aria-label={`Editar mesa ${g.name}`} disabled={busy}><Pencil size={14}/></button>
          <button type="button" className="delete-group-action" onClick={() => deleteGroup(g)} title={`Eliminar mesa ${g.name}`} aria-label={`Eliminar mesa ${g.name}`} disabled={busy}><Trash2 size={14}/></button>
        </div>
      </article>)}</div> : <div className="empty-state home-empty"><span>🗒️</span><strong>Todavía no hay mesas creadas</strong><p>Creá la primera y empezá a guardar sus partidas.</p><button type="button" className="button secondary" onClick={() => setScreen('newgroup')}><Plus size={16}/> Crear la primera mesa</button></div>}
      <form className="join-strip" onSubmit={joinGroup}><div className="join-icon"><Users size={21}/></div><div><strong>¿Te compartieron el ID de una mesa?</strong><p>Ingresalo para abrir su historial.</p></div><input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="ID de la mesa" required/><input value={joinAccessCode} onChange={e => setJoinAccessCode(e.target.value)} placeholder="Clave (si tiene)"/><button className="button secondary">Entrar</button></form>
      <p className="privacy-note"><NotebookPen size={15}/> Las partidas se guardan en Google Sheets, no en el almacenamiento del navegador.</p>
    </>}

    {screen === 'newgroup' && <>
      <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Volver a mis mesas</button>
      <section className="form-panel new-group-panel"><span className="eyebrow">UNA MESA PROPIA</span><h1>¿Quiénes se juntan?</h1><p>Creá un espacio para tu grupo. Las partidas y los resultados van a quedar guardados en su propio historial.</p>
        <form onSubmit={createGroup}>
          <label>Nombre de la mesa<input required maxLength="60" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Ej. Los del domingo" autoFocus/></label>
          <label>Clave de acceso (opcional)<input value={groupForm.accessCode} onChange={e => setGroupForm({ ...groupForm, accessCode: e.target.value })} placeholder="Una clave para compartir solo con tu grupo" autoComplete="new-password"/><small className="field-help">Si agregás una clave, vas a necesitarla para volver a entrar.</small></label>
          <button className="button primary wide" disabled={busy}><Plus size={17}/> Crear mesa <span>→</span></button>
        </form>
      </section>
    </>}

    {screen === 'group' && group && <>
      <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Todas las mesas</button>
      <section className="group-banner"><div><span className="eyebrow">TU MESA</span><h1>{group.name}</h1><p>Un espacio para sumar puntos, anécdotas y revancha.</p><div className="group-id">ID para compartir: <code>{group.id}</code><button onClick={() => navigator.clipboard?.writeText(group.id)} title="Copiar ID">Copiar</button></div></div><div className="banner-stamp">QUE<br/>GANE<br/>EL MEJOR</div></section>
      <div className="action-row"><div><span className="eyebrow">¿QUÉ JUGAMOS?</span><h2>Elegí tu juego</h2></div><button className="button secondary" onClick={() => setScreen('rules')}><Settings2 size={16}/> Reglas</button></div>
      <div className="game-grid">{GAMES.map(g => <button className={`game-card ${g.color}`} key={g.id} onClick={() => { chooseGame(g.id); setScreen('newgame'); }}><span className="game-emoji">{g.emoji}</span><strong>{g.name}</strong><small>{g.description}</small><span className="game-arrow">↗</span></button>)}</div>
      <section className="history-section"><div className="section-head"><div><span className="eyebrow">LOS RECUERDOS</span><h2>Historial de partidas</h2></div><span className="count-pill">{history.length} partidas</span></div>{history.length ? <div className="history-list">{history.map((g, i) => <div className="history-item" key={g.id}><div className={`history-icon note-${i%4}`}>{GAMES.find(x => x.id === g.gameId)?.emoji || '🎲'}</div><div className="history-main"><strong>{g.title || g.gameName}</strong><span>{g.gameName} · {(g.players || []).map(p => p.name).join(', ')}</span><small>{g.finishedAt ? `Finalizada · ${new Date(g.finishedAt).toLocaleDateString('es-AR')}` : 'En curso'}</small></div><div className="history-score">{g.winner ? <><Trophy size={15}/><span>{g.winner}</span></> : <span className="in-progress">En juego</span>}</div></div>)}</div> : <div className="empty-state"><span>🗒️</span><strong>Acá van a quedar las partidas</strong><p>Cuando terminen de jugar, vas a poder volver a ver los resultados.</p></div>}</section>
    </>}

    {screen === 'newgame' && group && <>
      <button className="back-link" onClick={() => setScreen('group')}><ArrowLeft size={16}/> Volver a la mesa</button>
      <section className="form-panel"><span className="eyebrow">NUEVA PARTIDA</span><h1>Armemos la mesa.</h1><p>Configuramos el marcador según el juego que eligieron.</p>
        <form onSubmit={startGame}>
          <label>Juego<select value={gameForm.gameId} onChange={e => { chooseGame(e.target.value); }} >{GAMES.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
          <label>Nombre de la partida (opcional)<input value={gameForm.title} onChange={e => setGameForm({ ...gameForm, title: e.target.value })} placeholder="Ej. Final del campeonato"/></label>
          {gameForm.gameId === 'truco' ? <div className="truco-setup">
            <div className="team-setup-card team-us"><span className="eyebrow">EQUIPO 1</span><label>Nombre del equipo<input value={teamSetup.names[0]} onChange={e => setTeamSetup(s => ({ ...s, names: s.names.map((n,i) => i===0 ? e.target.value : n) }))} placeholder="Nosotros" required/></label><label>Integrantes (separados por coma)<input value={teamSetup.members[0]} onChange={e => setTeamSetup(s => ({ ...s, members: s.members.map((n,i) => i===0 ? e.target.value : n) }))} placeholder="Ej. Luli, Toto"/></label></div>
            <div className="team-setup-card team-them"><span className="eyebrow">EQUIPO 2</span><label>Nombre del equipo<input value={teamSetup.names[1]} onChange={e => setTeamSetup(s => ({ ...s, names: s.names.map((n,i) => i===1 ? e.target.value : n) }))} placeholder="Ellos" required/></label><label>Integrantes (separados por coma)<input value={teamSetup.members[1]} onChange={e => setTeamSetup(s => ({ ...s, members: s.members.map((n,i) => i===1 ? e.target.value : n) }))} placeholder="Ej. Fede, Juli"/></label></div>
            <p className="game-help">El marcador se lleva por equipos. Podés jugar mano a mano o en parejas; los nombres de quienes integran cada equipo quedan asociados a la partida.</p>
          </div> : <>
            <div className="players-head"><label>Jugadores <small>mínimo 2</small></label><button type="button" className="text-button" onClick={addPlayer}><Plus size={15}/> Agregar jugador</button></div>
            <div className="player-fields">{gameForm.players.map((p,i) => <div className="player-field" key={i}><span>{String(i+1).padStart(2,'0')}</span><input value={p} onChange={e => setPlayer(i,e.target.value)} placeholder={`Nombre de jugador/a ${i+1}`} required/><button type="button" title="Quitar jugador" disabled={gameForm.players.length<=2} onClick={() => setGameForm(f => ({ ...f, players: f.players.filter((_,j) => j!==i) }))}>×</button></div>)}</div>
          </>}
          <div className="rule-summary"><Settings2 size={17}/><span><strong>Reglas actuales:</strong> {rules[selectedGame.id].direction === 'lower' ? 'gana quien acumula menos' : 'gana quien acumula más'}{rules[selectedGame.id].target ? ` · objetivo ${rules[selectedGame.id].target} ${rules[selectedGame.id].unit}` : ''}</span><button type="button" onClick={() => openRuleEditor(selectedGame.id, 'newgame')}>Editar reglas</button></div>
          <button className="button primary wide" disabled={busy}>Empezar partida <span>→</span></button>
        </form>
      </section>
    </>}

    {screen === 'play' && activeGame && <>
      <button className="back-link" onClick={() => setScreen('group')}><ArrowLeft size={16}/> Volver a la mesa</button>
      <section className="play-heading"><span className="eyebrow">PARTIDA EN CURSO · {activeGame.gameName}</span><h1>{activeGame.title}</h1><p>{activeGame.gameId === 'truco' ? 'Tocá los tantos del equipo y guardá el marcador al terminar la mano.' : activeGame.gameId === 'escoba' ? 'Anotá las escobas y quién se lleva cada categoría de la mano.' : activeGame.gameId === 'chinchon' ? 'Anotá los puntos que suma cada persona en la mano. El puntaje más bajo conviene.' : activeGame.gameId === 'rummy' ? 'Anotá los puntos de las cartas que quedan en la mano de cada persona.' : 'Cargá los puntos que suma o resta cada participante.'}</p></section>

      {activeGame.gameId === 'truco' ? <>
        <section className="truco-board">
          <div className="truco-board-top"><div><span className="eyebrow">MARCADOR DE TRUCO</span><h2>Hasta {trucoTarget} tantos</h2></div><div className="target-stamp"><strong>{Math.max(0, trucoTarget - Math.max(...activeGame.players.map(p => shownTruco(p.name))))}</strong><small>para ganar</small></div></div>
          <div className="truco-column-labels"><span>EQUIPO</span><span>MALAS · 1–{trucoSplit}</span><span>BUENAS · {trucoSplit+1}–{trucoTarget}</span><span>TANTOS</span></div>
          {activeGame.players.map((p, i) => {
            const score = Math.max(0, Math.min(trucoTarget, shownTruco(p.name)));
            const malas = Math.min(score, trucoSplit);
            const buenas = Math.max(0, score - trucoSplit);
            const won = score >= trucoTarget;
            return <div className={`truco-team-row ${i===0?'our-team':'their-team'} ${won?'team-winner':''}`} key={p.id || p.name}>
              <div className="truco-team-title"><strong>{p.name}</strong>{activeGame.rules?.teamMembers?.[p.name]?.length > 0 && <small>{activeGame.rules.teamMembers[p.name].join(' · ')}</small>}{won && <span>¡Ganó!</span>}</div>
              <div className="score-section"><small>MALAS</small><div className="score-sticks">{Array.from({ length: trucoSplit }, (_, n) => <span key={n} className={n < malas ? 'stick filled' : 'stick'} />)}</div><b>{malas}</b></div>
              <div className="score-section buenas-section"><small>BUENAS</small><div className="score-sticks">{Array.from({ length: trucoTarget-trucoSplit }, (_, n) => <span key={n} className={n < buenas ? 'stick filled' : 'stick'} />)}</div><b>{buenas}</b></div>
              <div className="truco-total">{score}<small>/{trucoTarget}</small></div>
            </div>;
          })}
        </section>
        <section className="truco-controls">
          <div className="special-panel-title"><div><span className="eyebrow">SUMAR TANTOS</span><h2>Tocá el equipo que suma</h2></div><span className="pending-pill">{Object.values(roundScores).reduce((s,n) => s + (Number(n)||0),0) > 0 ? 'Cambios sin guardar' : 'Marcador guardado'}</span></div>
          <div className="truco-quick-grid">
            {activeGame.players.map((p, i) => <div className={`truco-quick-card ${i===0?'our-quick':'their-quick'}`} key={p.id || p.name}>
              <strong>{p.name}</strong><span className="quick-current">{shownTruco(p.name)} <small>tantos</small></span>
              <div className="quick-buttons">
                {[1,2,3,4].map(n => <button type="button" key={n} onClick={() => setRoundScores(s => ({ ...s, [p.name]: Math.min(trucoTarget - (Number(totals[p.name])||0), Math.max(-(Number(totals[p.name])||0), (Number(s[p.name])||0)+n)) }))} disabled={busy || shownTruco(p.name)>=trucoTarget}>+{n}</button>)}
                <button type="button" className="undo-point" title="Restar un tanto de los pendientes" onClick={() => setRoundScores(s => ({ ...s, [p.name]: Math.max(-(Number(totals[p.name])||0), (Number(s[p.name])||0)-1) }))} disabled={busy || (Number(roundScores[p.name])||0)<=0}><Undo2 size={15}/></button>
              </div>
              {activeGame.rules?.teamMembers?.[p.name]?.length > 0 && <small className="team-members-note">{activeGame.rules.teamMembers[p.name].join(' · ')}</small>}
            </div>)}
          </div>
          <div className="truco-tip">Los botones cargan los tantos de manera provisoria. Al guardar, quedan registrados en Google Sheets como una anotación de la mano.</div>
          <label className="note-label">Nota de la mano (opcional)<input value={roundNote} onChange={e => setRoundNote(e.target.value)} placeholder="Ej. envido, falta envido, vale cuatro…"/></label>
          <div className="truco-save-row"><button className="button secondary" onClick={() => setRoundScores(Object.fromEntries(activeGame.players.map(p => [p.name, 0])))} disabled={busy}><RotateCcw size={16}/> Descartar cambios</button><button className="button primary" onClick={addRound} disabled={busy || !Object.values(roundScores).some(n => Number(n)!==0)}><Check size={17}/> Guardar tanteo</button></div>
        </section>
      </> : <>
        <div className="scoreboard"><div className="scoreboard-head"><h2><Trophy size={20}/> Marcador</h2><span>{(activeGame.rounds || []).length} rondas</span></div>{ranking.map(([name,score],i) => <div className={`score-row ${i===0?'leader':''}`} key={name}><span className="rank">{i===0?'✦':String(i+1).padStart(2,'0')}</span><strong>{name}</strong><span className="total-score">{score}</span></div>)}</div>
        <section className="round-panel">
          <span className="eyebrow">RONDA {(activeGame.rounds || []).length + 1}</span>
          <h2>{activeGame.gameId === 'escoba' ? '¿Quién se lleva los puntos?' : activeGame.gameId === 'chinchon' ? 'Puntos de la mano' : activeGame.gameId === 'rummy' ? 'Cartas que quedaron en la mano' : 'Anotá los puntos'}</h2>
          <p>{activeGame.gameId === 'escoba' ? 'Cada escoba suma 1. Las categorías se otorgan con los selectores de abajo.' : activeGame.gameId === 'chinchon' ? 'Ingresá la penalización de cada jugador. Si alguien hizo chinchón, podés aplicar el bonus configurado.' : activeGame.gameId === 'rummy' ? 'Cargá la suma de valores de las cartas que cada persona no pudo bajar. En esta variante, menos puntos es mejor.' : 'Usá valores negativos si necesitás restar puntos.'}</p>
          <div className="round-inputs">{activeGame.players.map((p,i) => <label key={p.id || p.name}><span>{activeGame.gameId === 'escoba' ? `${p.name} · escobas` : p.name}</span><div className="number-stepper"><button type="button" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name])||0)-1 }))}><Minus size={16}/></button><input type="number" value={roundScores[p.name] ?? 0} onChange={e => setRoundScores(s => ({ ...s, [p.name]: e.target.value }))}/><button type="button" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name])||0)+1 }))}><Plus size={16}/></button></div></label>)}</div>
          {activeGame.gameId === 'escoba' && <div className="escoba-awards"><div className="special-panel-title"><div><span className="eyebrow">CATEGORÍAS DE LA ESCOBA</span><h3>Un punto para quien corresponda</h3></div></div>{[
            ['masCartas','Más cartas'], ['masOros','Más oros'], ['sieteOro','Siete de oros'], ['masSietes','Más sietes']
          ].map(([key,label]) => <label className="award-row" key={key}><span>{label}<small> +1 punto</small></span><select value={escobaAwards[key]} onChange={e => setEscobaAwards(s => ({ ...s, [key]: e.target.value }))}><option value="">Sin punto / empate</option>{activeGame.players.map(p => <option value={p.name} key={p.name}>{p.name}</option>)}</select></label>)}</div>}
          {activeGame.gameId === 'chinchon' && <label className="bonus-select">¿Alguien hizo chinchón? (opcional)<select value={chinchonPlayer} onChange={e => setChinchonPlayer(e.target.value)}><option value="">No aplicar bonus</option>{activeGame.players.map(p => <option value={p.name} key={p.name}>{p.name} (−{Math.abs(Number(activeGame.rules?.chinchonBonus ?? 10))} puntos)</option>)}</select></label>}
          <label>Nota de la ronda (opcional)<input value={roundNote} onChange={e => setRoundNote(e.target.value)} placeholder={activeGame.gameId === 'escoba' ? 'Ej. última carta, jugada especial…' : 'Ej. cierre, cartas restantes…'}/></label>
          <button className="button primary wide" onClick={addRound} disabled={busy}><PlusCircle size={17}/> Guardar ronda</button>
        </section>
      </>}
      {(activeGame.rounds || []).length > 0 && <section className="round-history"><h2>Rondas anteriores</h2>{activeGame.rounds.map((r,i) => <div className="round-line" key={r.id || i}><span>Ronda {i+1}{r.note ? ` · ${r.note}` : ''}</span><span>{activeGame.players.map(p => `${p.name}: ${r.scores?.[p.name] ?? 0}`).join('  /  ')}</span></div>)}</section>}
      {activeGame.gameId === 'truco' && activeGame.players.some(p => Number(totals[p.name]) >= trucoTarget) && <div className="alert success">¡El objetivo de tantos se alcanzó! Revisen el marcador y finalicen la partida.</div>}
      {activeGame.gameId === 'chinchon' && activeGame.rules?.endAtTarget !== false && activeGame.players.some(p => Number(totals[p.name]) >= Number(activeGame.rules.target)) && <div className="alert error">Al menos una persona alcanzó el límite de {activeGame.rules.target} puntos. Revisen sus reglas de mesa antes de finalizar.</div>}
      <button className="button finish-button" onClick={finishGame} disabled={busy}><Trophy size={17}/> Finalizar partida</button>
    </>}

    {screen === 'rules' && <>
      <button className="back-link" onClick={() => setScreen(group ? 'group' : 'home')}><ArrowLeft size={16}/> Volver</button>
      <section className="form-panel rules-panel rules-picker-panel"><span className="eyebrow">AJUSTES DE JUEGO</span><h1>Reglas a tu manera.</h1><p>Elegí un juego para configurar solamente sus reglas. Cada marcador tiene sus propias opciones.</p>
        <div className="rule-picker-grid">{GAMES.map(g => <button type="button" className={`rule-picker-card ${g.color}`} key={g.id} onClick={() => openRuleEditor(g.id, 'rules')}><span className="rule-picker-emoji">{g.emoji}</span><span className="rule-picker-name">{g.name}</span><span className="rule-picker-description">{g.description}</span><span className="rule-picker-link">Editar reglas <span>↗</span></span></button>)}</div>
      </section>
    </>}

    {screen === 'rule-editor' && <>
      <button className="back-link" onClick={() => setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules')}><ArrowLeft size={16}/> {ruleReturnTo === 'newgame' ? 'Volver a la partida' : 'Volver a los juegos'}</button>
      <section className="form-panel rules-panel rule-editor-panel"><div className={`rule-editor-hero ${ruleGame.color}`}><span className="rule-editor-emoji">{ruleGame.emoji}</span><span className="eyebrow">EDITOR EXCLUSIVO</span><h1>Reglas de {ruleGame.name}</h1><p>Estos ajustes se aplican a las nuevas partidas de este juego en la mesa {group?.name ? `“${group.name}”` : 'actual'}.</p></div>
        <div className="rule-card rule-editor-card">
          <div className="rule-title"><span>{ruleGame.emoji}</span><strong>{ruleGame.name}</strong><span className="saved-note">Cambios pendientes de guardar</span></div>
          {ruleGame.id !== 'truco' && <label>¿Cómo se gana?<select value={ruleValues.direction} onChange={e => changeRuleDraft('direction', e.target.value)}><option value="higher">Gana el puntaje más alto</option><option value="lower">Gana el puntaje más bajo</option></select></label>}
          <div className="rule-two"><label>{ruleGame.id === 'chinchon' || ruleGame.id === 'rummy' ? 'Límite de puntos' : ruleGame.id === 'truco' ? 'Objetivo del partido' : ruleGame.id === 'escoba' ? 'Objetivo de tantos' : 'Objetivo (0 = sin objetivo)'}<input type="number" min={ruleGame.id === 'truco' ? 2 : 0} value={ruleValues.target ?? 0} onChange={e => changeRuleDraft('target', Math.max(ruleGame.id === 'truco' ? 2 : 0, Number(e.target.value)))} /></label><label>Nombre del puntaje<input value={ruleValues.unit || ''} onChange={e => changeRuleDraft('unit', e.target.value)} placeholder="puntos, tantos…" maxLength="24"/></label></div>
          {ruleGame.id === 'chinchon' && <>
            <label>Bonus por hacer chinchón (se resta)<input type="number" min="0" value={ruleValues.chinchonBonus ?? 10} onChange={e => changeRuleDraft('chinchonBonus', Math.max(0, Number(e.target.value)))}/></label>
            <label>¿Avisar cuando alguien alcance el límite?<select value={ruleValues.endAtTarget === false ? 'no' : 'yes'} onChange={e => changeRuleDraft('endAtTarget', e.target.value === 'yes')}><option value="yes">Sí, mostrar aviso</option><option value="no">No mostrar aviso</option></select></label>
            <p className="rule-explainer">La app suma las penalizaciones que ingresás en cada ronda. Si alguien hace chinchón, podés aplicar el bonus configurado.</p>
          </>}
          {ruleGame.id === 'escoba' && <>
            <div className="rule-two"><label>Puntos por cada escoba<input type="number" min="0" max="20" value={ruleValues.pointsPerEscoba ?? 1} onChange={e => changeRuleDraft('pointsPerEscoba', Math.max(0, Number(e.target.value)))}/></label><label>Puntos por categoría<input type="number" min="0" max="20" value={ruleValues.pointsPerCategory ?? 1} onChange={e => changeRuleDraft('pointsPerCategory', Math.max(0, Number(e.target.value)))}/></label></div>
            <p className="rule-explainer">Las categorías son más cartas, más oros, siete de oros y más sietes. Los empates pueden quedar sin punto. Al cargar una ronda, indicás cuántas escobas consiguió cada jugador.</p>
          </>}
          {ruleGame.id === 'truco' && <>
            <label>División entre malas y buenas<input type="number" min="1" max={Math.max(1, Number(ruleValues.target) - 1)} value={ruleValues.splitAt ?? Math.floor(Number(ruleValues.target || 30) / 2)} onChange={e => changeRuleDraft('splitAt', Math.max(1, Math.min(Math.max(1, Number(ruleValues.target) - 1), Number(e.target.value) || 1)))}/><small className="field-help">Ejemplo: un partido a 30 tantos se divide en 15 malas y 15 buenas.</small></label>
            <p className="rule-explainer">El marcador se lleva por dos equipos. Los botones rápidos suman de 1 a 4 tantos. Podés anotar en la mano si fueron envido, real envido, truco, retruco o vale cuatro.</p>
          </>}
          {ruleGame.id === 'rummy' && <p className="rule-explainer">Esta variante acumula manualmente los valores de las cartas que quedan en la mano. Con “gana el puntaje más bajo”, vence quien acumule menos penalizaciones.</p>}
          {ruleGame.id === 'libre' && <p className="rule-explainer">Marcador flexible: en cada ronda podés sumar o restar cualquier cantidad. Elegí si gana el puntaje más alto o el más bajo, y dejá el objetivo en 0 si no hay una meta.</p>}
        </div>
        <div className="rule-editor-actions"><button type="button" className="button secondary" onClick={() => setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules')}>Cancelar</button><button type="button" className="button primary" onClick={saveRuleEditor} disabled={busy}><Check size={16}/> Guardar reglas</button></div>
      </section>
    </>}
    {showInstallHelp && <div className="install-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowInstallHelp(false); }}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button className="install-close" type="button" onClick={() => setShowInstallHelp(false)} aria-label="Cerrar instrucciones"><X size={18}/></button>
        <div className="install-intro"><img src="/logo.png" alt="Logo de Partiditas"/><div><span className="eyebrow">PARTIDITAS EN TU CELULAR</span><h2 id="install-title">Llevá la mesa con vos.</h2><p>Agregá Partiditas a la pantalla de inicio para abrirla como una app.</p></div></div>
        <div className="install-tabs" role="tablist" aria-label="Elegí tu dispositivo">
          <button type="button" role="tab" aria-selected={installTab === 'iphone'} className={installTab === 'iphone' ? 'active' : ''} onClick={() => setInstallTab('iphone')}>iPhone / iPad</button>
          <button type="button" role="tab" aria-selected={installTab === 'android'} className={installTab === 'android' ? 'active' : ''} onClick={() => setInstallTab('android')}>Android</button>
        </div>
        {installTab === 'iphone' ? <div className="install-instructions">
          <p className="install-platform-label"><Smartphone size={17}/> En iPhone o iPad</p>
          <ol><li>Abrí <strong>{window.location.host}</strong> en <strong>Safari</strong>.</li><li>Tocá el botón <strong>Compartir</strong> <Share size={14} className="inline-install-icon"/> (el cuadrado con la flecha hacia arriba).</li><li>Deslizá las opciones y elegí <strong>Agregar a pantalla de inicio</strong>.</li><li>Confirmá con <strong>Agregar</strong>. Listo: vas a ver el ícono de Partiditas entre tus apps.</li></ol>
          <p className="install-hint">Si no aparece la opción, asegurate de abrir la web en Safari y no dentro de otra aplicación.</p>
        </div> : <div className="install-instructions">
          <p className="install-platform-label"><Smartphone size={17}/> En Android</p>
          {deferredInstallPrompt && <button type="button" className="button primary wide install-now-button" onClick={installOnAndroid}><Download size={16}/> Instalar ahora</button>}
          <ol><li>Abrí <strong>{window.location.host}</strong> en <strong>Google Chrome</strong>.</li><li>{deferredInstallPrompt ? <>También podés tocar <strong>Instalar ahora</strong> arriba y aceptar el aviso de Chrome.</> : <>Tocá el menú de los tres puntos <strong>⋮</strong>, arriba a la derecha.</>}</li><li>Elegí <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>. El nombre puede variar según el teléfono.</li><li>Confirmá con <strong>Instalar</strong> o <strong>Agregar</strong>. Después vas a encontrar Partiditas en la pantalla de inicio.</li></ol>
          {!deferredInstallPrompt && <p className="install-hint">Si Chrome ofrece directamente “Instalar aplicación”, usá esa opción. No hace falta descargar un APK.</p>}
        </div>}
        <div className="install-footer-note"><img src="/logo.png" alt=""/><p>Es una aplicación web instalable. Las partidas se siguen guardando en Google Sheets; la instalación no crea una copia de tus partidas en el teléfono.</p></div>
      </section>
    </div>}
    <footer><span className="footer-brand"><img src="/logo.png" alt=""/><span>partiditas</span></span><a className="footer-nomade" href="https://www.somosnomade.com.ar/" target="_blank" rel="noreferrer">hecho para jugar juntxs por <strong>NÓMADE</strong> <span>♥</span></a></footer>
  </main>;
}
