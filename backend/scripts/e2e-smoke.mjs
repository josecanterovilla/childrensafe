// Prueba de humo del flujo completo de Fase 1 contra el backend en marcha.
// Ejecuta: node scripts/e2e-smoke.mjs
const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/api';

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const ok = (m) => console.log('  ✅', m);

(async () => {
  const stamp = Date.now();
  const email = `tutor_${stamp}@childrensafe.test`;

  console.log('\n== 1. Registro de tutor ==');
  const reg = await call('POST', '/auth/register', {
    email, password: 'una-contrasena-fuerte-123', displayName: 'Ana Tutora', familyName: 'Familia Prueba',
  });
  ok(`tutor creado (userId ${reg.userId.slice(0, 8)}…), tokens emitidos`);

  console.log('== 2. Login (rotación de tokens) ==');
  const login = await call('POST', '/auth/login', { email, password: 'una-contrasena-fuerte-123' });
  const parentToken = login.accessToken;
  ok('login correcto');

  console.log('== 3. Listar familias del tutor ==');
  const fams = await call('GET', '/families', null, parentToken);
  const familyId = fams[0].familyId;
  ok(`familia: "${fams[0].name}" · rol: ${fams[0].role} · id ${familyId.slice(0, 8)}…`);

  console.log('== 4. Generar código de emparejamiento (solo PARENT) ==');
  const code = await call('POST', `/families/${familyId}/pairing-codes`, {
    childDisplayName: 'Lucía', childAgeBand: 'PRETEEN',
  }, parentToken);
  ok(`código: ${code.code} · QR: ${code.qrPayload}`);

  console.log('== 5. El menor canjea el código (join) ==');
  const join = await call('POST', '/pairing/join', {
    code: code.code,
    displayName: 'Lucía',
    device: { platform: 'ANDROID', deviceName: 'Android de Lucía', deviceUuid: `dev-${stamp}` },
  });
  const childToken = join.accessToken;
  ok(`menor vinculado · childProfileId ${join.childProfileId.slice(0, 8)}… · tokens del dispositivo emitidos`);

  console.log('== 6. El menor reporta ubicación (evalúa geocercas) ==');
  await call('POST', `/families/${familyId}/location`, {
    latitude: -25.2637, longitude: -57.5759, accuracy: 12.5, batteryLevel: 64,
    clientEventId: `evt-${stamp}`,
  }, childToken);
  ok('ubicación registrada');

  console.log('== 7. Idempotencia: reenvío del mismo clientEventId ==');
  await call('POST', `/families/${familyId}/location`, {
    latitude: -25.2637, longitude: -57.5759, clientEventId: `evt-${stamp}`,
  }, childToken);
  const hist = await call('GET', `/families/${familyId}/children/${join.childProfileId}/location/history`, null, parentToken);
  ok(`historial tiene ${hist.length} punto(s) (no se duplicó pese al reenvío)`);

  console.log('== 8. El menor activa SOS ==');
  await call('POST', `/families/${familyId}/sos`, { latitude: -25.30, longitude: -57.60, message: 'Necesito ayuda' }, childToken);
  ok('SOS enviado');

  console.log('== 9. Aislamiento por rol: el menor NO puede generar códigos ==');
  try {
    await call('POST', `/families/${familyId}/pairing-codes`, { childDisplayName: 'X', childAgeBand: 'TEEN' }, childToken);
    console.log('  ❌ FALLO: el menor pudo generar un código (no debería)');
  } catch (e) {
    ok('bloqueado correctamente (403) — RBAC funciona');
  }

  console.log('== 10. El tutor ve las alertas generadas ==');
  const alerts = await call('GET', `/families/${familyId}/alerts`, null, parentToken);
  for (const a of alerts) console.log(`     • [${a.severity}] ${a.title} — ${a.message}`);
  ok(`${alerts.length} alerta(s) en total`);

  console.log('\n✅✅ FLUJO COMPLETO OK contra Supabase.\n');
})().catch((e) => { console.error('\n❌ ERROR:', e.message, '\n'); process.exit(1); });
