import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QUESTIONS from './src/data/questions.json';
import { load, save, empty } from './src/store';
import { C } from './src/theme';

/* ---------- utilidades ---------- */
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const TEMAS = [...new Set(QUESTIONS.map((q) => q.tema))];
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const st = (s, id) => s.q[id] || { seen: 0, ok: 0, ko: 0 };
const DAY = 86400000;
const BOX_DAYS = [0, 0, 1, 3, 7, 14];

function pick(mode, n, tema, s) {
  let pool = QUESTIONS.filter((q) => !st(s, q.id).learned);
  if (mode === 'tema') pool = pool.filter((q) => q.tema === tema);
  if (mode === 'falladas') pool = pool.filter((q) => st(s, q.id).ko > 0).sort((a, b) => st(s, b.id).ko - st(s, a.id).ko);
  else if (mode === 'peor') pool = pool.filter((q) => st(s, q.id).seen > 0).sort((a, b) => st(s, a.id).ok / st(s, a.id).seen - st(s, b.id).ok / st(s, b.id).seen);
  else if (mode === 'menos') pool = pool.sort((a, b) => st(s, a.id).seen - st(s, b.id).seen);
  else if (mode === 'importantes') pool = pool.filter((q) => st(s, q.id).important);
  else pool = shuffle(pool);
  return pool.slice(0, n);
}

function applyResult(s, res) {
  const q = { ...s.q };
  res.items.forEach(({ q: qq, a }) => {
    if (a == null) return;
    const x = { ...(q[qq.id] || { seen: 0, ok: 0, ko: 0 }) };
    x.seen++; a === qq.c ? x.ok++ : x.ko++; x.last = Date.now(); q[qq.id] = x;
  });
  return { ...s, q, history: [...s.history, { t: Date.now(), kind: res.kind, ok: res.ok, ko: res.ko, blank: res.blank, nota: res.nota }] };
}

/* ---------- UI base ---------- */
const Btn = ({ t, onPress, kind = 'main', style, disabled }) => (
  <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [s.btn, kind === 'ghost' && s.btnGhost, kind === 'bad' && { backgroundColor: C.bad }, disabled && { opacity: 0.4 }, pressed && { opacity: 0.8 }, style]}>
    <Text style={[s.btnT, kind === 'ghost' && { color: C.ink }]}>{t}</Text>
  </Pressable>
);
const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
const Chip = ({ t, on, onPress }) => (
  <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}><Text style={[s.chipT, on && { color: '#fff' }]}>{t}</Text></Pressable>
);
const Bar = ({ v, color = C.accent }) => (
  <View style={s.barBg}><View style={[s.barFg, { width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, backgroundColor: color }]} /></View>
);

/* ---------- Runner: test / estudio / contrarreloj / simulacro ---------- */
function Runner({ run, store, onToggle, onFinish, onExit }) {
  const { questions, kind, seconds } = run;
  const study = kind === 'study';
  const [i, setI] = useState(0);
  const [ans, setAns] = useState({});
  const [doubt, setDoubt] = useState({});
  const [left, setLeft] = useState(seconds ?? null);
  const ansRef = useRef({}); ansRef.current = ans;
  const doubtRef = useRef({}); doubtRef.current = doubt;
  const done = useRef(false);

  const finish = () => {
    if (done.current) return; done.current = true;
    const items = questions.map((q) => ({ q, a: ansRef.current[q.id] ?? null, d: !!doubtRef.current[q.id] }));
    const ok = items.filter((x) => x.a != null && x.a === x.q.c).length;
    const ko = items.filter((x) => x.a != null && x.a !== x.q.c).length;
    const net = ok - ko / 3;
    const netNoDoubt = items.reduce((t, x) => (x.a == null || x.d ? t : t + (x.a === x.q.c ? 1 : -1 / 3)), 0);
    onFinish({ kind, items, ok, ko, blank: items.length - ok - ko, net, nota: Math.max(0, (net / items.length) * 10), notaSinDudas: Math.max(0, (netNoDoubt / items.length) * 10) });
  };

  useEffect(() => {
    if (left == null) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left != null && left <= 0) finish(); }, [left]);

  const q = questions[i];
  const a = ans[q.id];
  const locked = study && a != null;
  const flags = store.q[q.id] || {};

  return (
    <View style={{ flex: 1 }}>
      <View style={s.runTop}>
        <Pressable onPress={onExit}><Text style={s.link}>Salir</Text></Pressable>
        <Text style={s.h3}>{i + 1} / {questions.length}</Text>
        {left != null ? <Text style={[s.h3, left < 60 && { color: C.bad }]}>{fmt(Math.max(0, left))}</Text> : <View style={{ width: 40 }} />}
      </View>
      <Bar v={(i + 1) / questions.length} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={s.tag}>{q.tema}</Text>
        <Text style={s.question}>{q.q}</Text>
        {q.o.map((o, k) => {
          const sel = a === k;
          const showRes = locked;
          const good = showRes && k === q.c;
          const bad = showRes && sel && k !== q.c;
          return (
            <Pressable key={k} disabled={locked} onPress={() => setAns({ ...ans, [q.id]: sel ? undefined : k })}
              style={[s.opt, sel && !showRes && { borderColor: C.accent, backgroundColor: C.accentSoft }, good && { borderColor: C.accent, backgroundColor: C.accentSoft }, bad && { borderColor: C.bad, backgroundColor: C.badSoft }]}>
              <Text style={s.optL}>{'abcd'[k]}</Text><Text style={s.optT}>{o}</Text>
            </Pressable>
          );
        })}
        {locked && !!q.e && <Card style={{ backgroundColor: C.goldSoft, borderColor: C.gold }}><Text style={s.body}>{q.e}</Text></Card>}
        <View style={s.row}>
          <Chip t={flags.important ? '★ Importante' : '☆ Importante'} on={!!flags.important} onPress={() => onToggle(q.id, 'important')} />
          <Chip t={flags.learned ? '✓ Aprendida' : 'Marcar aprendida'} on={!!flags.learned} onPress={() => onToggle(q.id, 'learned')} />
          {kind === 'sim' && <Chip t={doubt[q.id] ? '? Dudosa' : 'Marcar dudosa'} on={!!doubt[q.id]} onPress={() => setDoubt({ ...doubt, [q.id]: !doubt[q.id] })} />}
        </View>
      </ScrollView>
      <View style={s.runBot}>
        <Btn t="Anterior" kind="ghost" disabled={i === 0} onPress={() => setI(i - 1)} style={{ flex: 1 }} />
        {i < questions.length - 1
          ? <Btn t="Siguiente" onPress={() => setI(i + 1)} style={{ flex: 1 }} />
          : <Btn t="Finalizar" onPress={finish} style={{ flex: 1 }} />}
      </View>
    </View>
  );
}

function Result({ res, store, onToggle, onClose }) {
  const fails = res.items.filter((x) => x.a != null && x.a !== x.q.c);
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>{res.nota.toFixed(2)} / 10</Text>
      <Card>
        <Text style={s.body}>Aciertos: {res.ok}   Fallos: {res.ko}   En blanco: {res.blank}</Text>
        <Text style={s.sub}>Puntos netos (fallo = −1/3): {res.net.toFixed(2)}</Text>
        {res.kind === 'sim' && res.items.some((x) => x.d) && <Text style={s.sub}>Dejando en blanco las dudosas: {res.notaSinDudas.toFixed(2)} / 10</Text>}
      </Card>
      {fails.length > 0 && <Text style={s.h2}>Falladas</Text>}
      {fails.map(({ q, a }) => (
        <Card key={q.id}>
          <Text style={s.body}>{q.q}</Text>
          <Text style={[s.sub, { color: C.bad }]}>Tu respuesta: {q.o[a]}</Text>
          <Text style={[s.sub, { color: C.accent }]}>Correcta: {q.o[q.c]}</Text>
          <Text style={s.sub}>{q.e}</Text>
          <Chip t={(store.q[q.id] || {}).important ? '★ Importante' : '☆ Importante'} on={!!(store.q[q.id] || {}).important} onPress={() => onToggle(q.id, 'important')} />
        </Card>
      ))}
      <Btn t="Cerrar" onPress={onClose} />
    </ScrollView>
  );
}

/* ---------- pantallas ---------- */
function Tests({ store, start }) {
  const [mode, setMode] = useState('aleatorio');
  const [tema, setTema] = useState(TEMAS[0]);
  const [n, setN] = useState(10);
  const [study, setStudy] = useState(false);
  const modes = [['aleatorio', 'Aleatorio'], ['tema', 'Por tema'], ['falladas', 'Falladas'], ['peor', 'Peor ratio'], ['menos', 'Menos vistas'], ['importantes', 'Importantes']];
  const go = (qs, kind, seconds) => qs.length ? start({ questions: qs, kind, seconds }) : alert('No hay preguntas para esa configuración todavía.');
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>Test configurable</Text>
      <View style={s.wrap}>{modes.map(([k, l]) => <Chip key={k} t={l} on={mode === k} onPress={() => setMode(k)} />)}</View>
      {mode === 'tema' && <View style={s.wrap}>{TEMAS.map((t) => <Chip key={t} t={t} on={tema === t} onPress={() => setTema(t)} />)}</View>}
      <Text style={s.sub}>Número de preguntas</Text>
      <View style={s.wrap}>{[10, 20, 40].map((x) => <Chip key={x} t={String(x)} on={n === x} onPress={() => setN(x)} />)}</View>
      <Chip t={study ? 'Modo estudio: ON (corrige al responder)' : 'Modo estudio: OFF'} on={study} onPress={() => setStudy(!study)} />
      <Btn style={{ marginTop: 12 }} t="Empezar test" onPress={() => go(pick(mode, n, tema, store), study ? 'study' : 'test', null)} />

      <Text style={s.h2}>Contrarreloj</Text>
      <View style={s.row}>{[5, 10, 20].map((m) => <Btn key={m} kind="ghost" style={{ flex: 1 }} t={`${m} min`} onPress={() => go(pick('aleatorio', m * 2, null, store), 'timed', m * 60)} />)}</View>

      <Text style={s.h2}>Simulacro oficial</Text>
      <Card><Text style={s.sub}>Hasta 80 preguntas en 120 minutos, navegación libre, dudosas y nota con penalización 1/3.</Text>
        <Btn t="Empezar simulacro" onPress={() => go(pick('aleatorio', 80, null, store), 'sim', 7200)} /></Card>
    </ScrollView>
  );
}

function Flash({ store, setStore }) {
  const initial = useMemo(() => QUESTIONS.filter((q) => !st(store, q.id).learned && (!store.cards[q.id] || store.cards[q.id].due <= Date.now())).map((q) => q.id), []);
  const [queue, setQueue] = useState(initial);
  const [show, setShow] = useState(false);
  const q = QUESTIONS.find((x) => x.id === queue[0]);
  if (!q) return <View style={{ padding: 16 }}><Text style={s.h1}>Flashcards</Text><Text style={s.body}>No tienes tarjetas pendientes. Vuelve mañana.</Text></View>;
  const box = (store.cards[q.id] || { box: 1 }).box;
  const rate = (okk) => {
    const nb = okk ? Math.min(5, box + 1) : 1;
    setStore({ ...store, cards: { ...store.cards, [q.id]: { box: nb, due: Date.now() + BOX_DAYS[nb] * DAY } } });
    setQueue(okk ? queue.slice(1) : [...queue.slice(1), q.id]);
    setShow(false);
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>Flashcards</Text>
      <Text style={s.sub}>Caja {box} de 5 · quedan {queue.length}</Text>
      <Card style={{ minHeight: 200 }}>
        <Text style={s.tag}>{q.tema}</Text>
        <Text style={s.question}>{q.q}</Text>
        {show && <><Text style={[s.body, { color: C.accent, fontWeight: '700' }]}>{q.o[q.c]}</Text><Text style={s.sub}>{q.e}</Text></>}
      </Card>
      {!show ? <Btn t="Ver respuesta" onPress={() => setShow(true)} /> :
        <View style={s.row}><Btn kind="bad" t="Fallé" style={{ flex: 1 }} onPress={() => rate(false)} /><Btn t="Acerté" style={{ flex: 1 }} onPress={() => rate(true)} /></View>}
    </ScrollView>
  );
}

function Stats({ store }) {
  const tot = Object.values(store.q).reduce((a, x) => ({ ok: a.ok + x.ok, ko: a.ko + x.ko }), { ok: 0, ko: 0 });
  const acc = tot.ok + tot.ko ? tot.ok / (tot.ok + tot.ko) : 0;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>Estadísticas</Text>
      <Card><Text style={s.body}>Acierto global: {Math.round(acc * 100)}%  ({tot.ok + tot.ko} respuestas)</Text><Bar v={acc} /></Card>
      <Text style={s.h2}>Por tema</Text>
      {TEMAS.map((t) => {
        const qs = QUESTIONS.filter((q) => q.tema === t); let ok = 0, n = 0;
        qs.forEach((q) => { const x = st(store, q.id); ok += x.ok; n += x.ok + x.ko; });
        const v = n ? ok / n : 0;
        return <Card key={t}><Text style={s.body}>{t}</Text><Text style={s.sub}>{n ? `${Math.round(v * 100)}% de acierto · ${n} respuestas` : 'Sin datos'}</Text><Bar v={v} color={v < 0.5 ? C.bad : v < 0.75 ? C.gold : C.accent} /></Card>;
      })}
      <Text style={s.h2}>Últimos tests</Text>
      {store.history.slice(-8).reverse().map((h, i) => (
        <Text key={i} style={s.sub}>{new Date(h.t).toLocaleDateString()} · {h.kind} · {h.nota.toFixed(2)}/10 ({h.ok}✓ {h.ko}✗)</Text>
      ))}
    </ScrollView>
  );
}

function Retos({ store }) {
  const now = Date.now();
  const sum = (ms) => store.history.filter((h) => now - h.t < ms).reduce((a, h) => a + h.ok + h.ko, 0);
  const week = sum(7 * DAY), month = sum(30 * DAY);
  const best = (k) => Math.max(0, ...store.history.filter((h) => h.kind === k).map((h) => h.nota));
  const tot = store.history.reduce((a, h) => a + h.ok + h.ko, 0);
  const badges = [['Primer test', store.history.length >= 1], ['100 preguntas', tot >= 100], ['Simulacro hecho', store.history.some((h) => h.kind === 'sim')], ['Nota ≥ 7 en test', best('test') >= 7 || best('study') >= 7]];
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>Retos</Text>
      <Card><Text style={s.body}>Semanal: {Math.min(week, 100)} / 100 preguntas</Text><Bar v={week / 100} /></Card>
      <Card><Text style={s.body}>Mensual: {Math.min(month, 400)} / 400 preguntas</Text><Bar v={month / 400} /></Card>
      <Text style={s.h2}>Récords contrarreloj</Text>
      <Card><Text style={s.body}>Mejor nota: {best('timed').toFixed(2)} / 10</Text></Card>
      <Text style={s.h2}>Insignias</Text>
      <View style={s.wrap}>{badges.map(([l, on]) => <Chip key={l} t={(on ? '🏅 ' : '🔒 ') + l} on={on} />)}</View>
      <Text style={s.sub}>La clasificación global y el Salón de la Fama necesitan un servidor; de momento los récords son locales.</Text>
    </ScrollView>
  );
}

function Home({ store, go, start }) {
  const seen = Object.values(store.q).filter((x) => x.seen > 0).length;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Image source={require('./assets/IconTai.png')} accessibilityLabel="TAI" style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 14 }} />
      <Card><Text style={s.body}>{seen} / {QUESTIONS.length} preguntas practicadas</Text><Bar v={seen / QUESTIONS.length} /></Card>
      <Btn t="Test rápido (10)" onPress={() => start({ questions: pick('aleatorio', 10, null, store), kind: 'test', seconds: null })} />
      <Btn kind="ghost" style={{ marginTop: 8 }} t="Repasar falladas" onPress={() => { const qs = pick('falladas', 20, null, store); qs.length ? start({ questions: qs, kind: 'test', seconds: null }) : alert('Aún no tienes falladas.'); }} />
      <Btn kind="ghost" style={{ marginTop: 8 }} t="Flashcards de hoy" onPress={() => go('flash')} />
    </ScrollView>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [store, setStoreRaw] = useState(empty);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('home');
  const [run, setRun] = useState(null);
  const [res, setRes] = useState(null);
  const [splash, setSplash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setSplash(false), 1400); return () => clearTimeout(t); }, []);

  useEffect(() => { load().then((x) => { setStoreRaw(x); setReady(true); }); }, []);
  const setStore = (x) => { setStoreRaw(x); save(x); };
  const toggle = (id, key) => setStore({ ...store, q: { ...store.q, [id]: { ...st(store, id), [key]: !st(store, id)[key] } } });
  const onFinish = (r) => { setStore(applyResult(store, r)); setRun(null); setRes(r); };

  if (!ready || splash) return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar barStyle="light-content" />
      <Image source={require('./assets/IconTai.png')} resizeMode="contain" style={{ width: 160, height: 160, borderRadius: 32 }} />
    </View>
  );
  const tabs = [['home', 'Inicio', 'home'], ['tests', 'Tests', 'document-text'], ['flash', 'Cards', 'albums'], ['stats', 'Stats', 'stats-chart'], ['retos', 'Retos', 'trophy']];
  let body;
  if (run) body = <Runner run={run} store={store} onToggle={toggle} onFinish={onFinish} onExit={() => setRun(null)} />;
  else if (res) body = <Result res={res} store={store} onToggle={toggle} onClose={() => setRes(null)} />;
  else body = { home: <Home store={store} go={setTab} start={setRun} />, tests: <Tests store={store} start={setRun} />, flash: <Flash store={store} setStore={setStore} />, stats: <Stats store={store} />, retos: <Retos store={store} /> }[tab];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1 }}>{body}</View>
      {!run && !res && (
        <View style={s.tabs}>{tabs.map(([k, l, ic]) => {
          const on = tab === k;
          return (
            <Pressable key={k} style={s.tab} onPress={() => setTab(k)}>
              <Ionicons name={on ? ic : ic + '-outline'} size={24} color={on ? C.accent : C.sub} />
              <Text style={[s.tabT, on && { color: C.accent, fontWeight: '700' }]}>{l}</Text>
            </Pressable>
          );
        })}</View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  h1: { fontSize: 26, fontWeight: '800', color: C.ink, marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: '700', color: C.ink, marginTop: 20, marginBottom: 8 },
  h3: { fontSize: 16, fontWeight: '700', color: C.ink },
  body: { fontSize: 16, color: C.ink, marginBottom: 6, lineHeight: 22 },
  sub: { fontSize: 14, color: C.sub, marginBottom: 6, lineHeight: 20 },
  tag: { fontSize: 13, color: C.accent, marginBottom: 6, fontWeight: '600' },
  question: { fontSize: 19, color: C.ink, fontWeight: '600', marginBottom: 14, lineHeight: 26 },
  card: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 10 },
  btn: { backgroundColor: C.ink, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.ink },
  btnT: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, marginRight: 8, marginBottom: 8, alignSelf: 'flex-start' },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipT: { fontSize: 14, color: C.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  barBg: { height: 6, backgroundColor: C.line, borderRadius: 3, overflow: 'hidden' },
  barFg: { height: 6, borderRadius: 3 },
  opt: { flexDirection: 'row', borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 8 },
  optL: { width: 24, fontWeight: '700', color: C.sub, fontSize: 16 },
  optT: { flex: 1, fontSize: 16, color: C.ink, lineHeight: 22 },
  runTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  runBot: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card },
  link: { color: C.bad, fontSize: 16, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card },
  tab: { flex: 1, paddingTop: 8, paddingBottom: 10, alignItems: 'center' },
  tabT: { fontSize: 11, color: C.sub, marginTop: 2 },
});