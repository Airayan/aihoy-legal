// functions/w/[token].js  →  aihoy.app/w/<token>
//
// Az utazási ablak CSAK tokennel érhető el. A tokent kizárólag a létrehozó
// tudja legenerálni (create_window_share_token), és bármikor visszavonhatja.
//
// FIGYELEM, hogy ne legyen félreértés: ez azt garantálja, hogy a linket csak a
// létrehozó tudja LÉTREHOZNI. A továbbküldését nem akadályozza meg semmi —
// épp ezért nem megy ki profilkép, koordináta, hangulat és korpreferencia.

import {
  callRpc, esc, clip, fmtDate, renderPage, renderGone, PLAY_URL,
} from '../_shared.js';

const TOKEN_RE = /^[0-9a-f]{8,64}$/i;

// A kulcsoknak a Flutter _activityOptions listájával kell egyezniük
// (lib/screens/travel_window_screen.dart). Ha ott új tevékenység kerül be,
// ide is fel kell venni — különben a weboldalon a nyers angol kulcs jelenik
// meg (pl. "nightlife") a magyar címke helyett.
const ACTIVITY_LABEL = {
  sailing: '⛵ Hajózás',
  diving: '🤿 Búvárkodás',
  snorkeling: '🥽 Snorkeling',
  fishing: '🎣 Horgászat',
  whale: '🐋 Bálnales',
  kayak: '🛶 Kajak',
  beach: '🏖 Strand',
  culture: '🏛 Kultúra',
  ruins: '🏺 Romkereső',
  hiking: '🥾 Gyaloglás',
  food: '🍽 Gasztro',
  nightlife: '🎉 Szórakozás',
  baby: '👶 Kisgyerekes',
  // Régi értékek: már nem választhatók az appban, de meglévő sorokban
  // még szerepelhetnek. Megtartva, hogy azok se essenek vissza nyers kulcsra.
  party: '🎉 Buli',
  surf: '🏄 Szörf',
  wakeboard: '🏄 Wakeboard',
};

export async function onRequestGet({ params, env }) {
  const token = String(params.token || '');

  if (!TOKEN_RE.test(token)) return renderGone('window');

  let w;
  try {
    w = await callRpc(env, 'get_public_window', { p_token: token });
  } catch (e) {
    console.error('[window]', e.message);
    return renderGone('window');
  }

  // Üres = nincs ilyen token, visszavonták, kikapcsolták, vagy lejárt.
  // Szándékosan nem különböztetjük meg — kívülről mindegy.
  if (!w) return renderGone('window');

  const from = fmtDate(w.date_from);
  const to = fmtDate(w.date_to);
  const range = from && to ? (from === to ? from : `${from} – ${to}`) : from || to;

  // Elsődlegesen a felhasználónév (display_name), ha a user beállított ilyet.
  // A first_name fallback KELL: a 25-ös migráció előtti RPC csak azt adta
  // vissza, és a userek kétharmadának nincs felhasználóneve (2026-08: 16/46) —
  // az ő esetükben a display_name maga is a keresztnevet hozza a szerverről.
  const displayName = w.display_name || w.first_name || '';
  const who = displayName ? `${displayName} utazása` : 'Utazás';

  const rows = [];
  if (w.destination) rows.push(['📍', clip(w.destination, 90)]);
  if (range) rows.push(['📅', range]);
  if (Array.isArray(w.languages) && w.languages.length > 0) {
    rows.push(['🗣', w.languages.join(', ')]);
  }

  const acts = Array.isArray(w.activities)
    ? w.activities.map((a) => ACTIVITY_LABEL[a] || a)
    : [];

  const inner = `
    <div class="card">
      <div class="body">
        <h1>${esc(who)}</h1>
        <div class="sub">Utazási ablak — ki lesz ott ugyanakkor?</div>
        <div class="rows">
          ${rows
            .map(
              ([ico, val]) =>
                `<div class="row"><span class="ico">${ico}</span><span class="val">${esc(val)}</span></div>`
            )
            .join('')}
        </div>
        ${w.description ? `<div class="desc">${esc(w.description)}</div>` : ''}
        ${
          acts.length
            ? `<div class="tags">${acts.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>`
            : ''
        }
        <a class="cta" href="${PLAY_URL}">Csatlakozom az Aihoy!-hoz</a>
        <div class="cta-note">Az appban látod, ki lesz még ott ugyanekkor.</div>
      </div>
    </div>`;

  const ogDesc = [w.destination ? clip(w.destination, 45) : '', range]
    .filter(Boolean)
    .join(' · ');

  return renderPage({
    title: `${who} — Aihoy!`,
    ogTitle: w.destination ? `${who}: ${clip(w.destination, 45)}` : who,
    ogDesc: ogDesc || 'Nézd meg az Aihoy!-ban.',
    // Utazási ablaknál SOSEM megy ki személyes kép — mindig az arculati kép.
    ogImage: null,
    ogUrl: `https://aihoy.app/w/${token}`,
    // A megosztott ablak ne kerüljön keresőbe: a link címzetteknek szól.
    noindex: true,
    inner,
  });
}
