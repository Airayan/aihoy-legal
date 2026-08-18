// functions/w/[token].js  →  aihoy.app/w/<token>
//
// Az utazási ablak CSAK tokennel érhető el. A tokent kizárólag a létrehozó
// tudja legenerálni (create_window_share_token), és bármikor visszavonhatja.
//
// FIGYELEM, hogy ne legyen félreértés: ez azt garantálja, hogy a linket csak a
// létrehozó tudja LÉTREHOZNI. A továbbküldését nem akadályozza meg semmi —
// épp ezért nem megy ki profilkép, koordináta, hangulat és korpreferencia.
//
// KIVÉTEL (2026-08-18, 30_travel_window_photo.sql): a létrehozó opcionálisan
// feltölthet egy KÜLÖN, csak erre az ablakra szánt képet (photo_url) — az
// NEM a profilkép, tudatos, ablakonkénti döntés, és MEGJELENIK a linken, ha
// van. Ha nincs feltöltve, a viselkedés változatlan (nincs kép).
//
// NYELV (2026-08-18): az oldal a LÁTOGATÓ böngészőnyelvén jelenik meg
// (Accept-Language → pickLang), nem a létrehozóén. A felhasználó saját
// szövege (úti cél, leírás) természetesen marad úgy, ahogy beírták.
// Részletes indoklás: _shared.js fejléc.

import {
  callRpc, esc, clip, fmtDate, renderPage, renderGone, PLAY_URL,
  pickLang, t, activityLabel,
} from '../_shared.js';

const TOKEN_RE = /^[0-9a-f]{8,64}$/i;

export async function onRequestGet({ params, env, request }) {
  const lang = pickLang(request);
  const token = String(params.token || '');

  if (!TOKEN_RE.test(token)) return renderGone('window', lang);

  let w;
  try {
    w = await callRpc(env, 'get_public_window', { p_token: token });
  } catch (e) {
    console.error('[window]', e.message);
    return renderGone('window', lang);
  }

  // Üres = nincs ilyen token, visszavonták, kikapcsolták, vagy lejárt.
  // Szándékosan nem különböztetjük meg — kívülről mindegy.
  if (!w) return renderGone('window', lang);

  const from = fmtDate(w.date_from);
  const to = fmtDate(w.date_to);
  const range = from && to ? (from === to ? from : `${from} – ${to}`) : from || to;

  // Elsődlegesen a felhasználónév (display_name), ha a user beállított ilyet.
  // A first_name fallback KELL: a 25-ös migráció előtti RPC csak azt adta
  // vissza, és a userek kétharmadának nincs felhasználóneve (2026-08: 16/46) —
  // az ő esetükben a display_name maga is a keresztnevet hozza a szerverről.
  const displayName = w.display_name || w.first_name || '';
  const who = displayName
    ? t(lang, 'windowWho', { name: displayName })
    : t(lang, 'windowWhoFallback');

  const rows = [];
  if (w.destination) rows.push(['📍', clip(w.destination, 90)]);
  if (range) rows.push(['📅', range]);
  if (Array.isArray(w.languages) && w.languages.length > 0) {
    // 🗣️ — variánsjelölővel (U+FE0F), különben a böngésző fekete-fehér
    // szimbólumként rajzolja, nem színes emojiként.
    rows.push(['🗣️', w.languages.join(', ')]);
  }

  const acts = Array.isArray(w.activities)
    ? w.activities.map((a) => activityLabel(lang, a))
    : [];

  const inner = `
    <div class="card">
      ${
        w.photo_url
          ? `<img class="hero" src="${esc(w.photo_url)}" alt="" loading="lazy">`
          : ''
      }
      <div class="body">
        <h1>${esc(who)}</h1>
        <div class="sub">${esc(t(lang, 'windowSub'))}</div>
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
        <a class="cta" href="${PLAY_URL}">${esc(t(lang, 'windowCta'))}</a>
        <div class="cta-note">${esc(t(lang, 'windowCtaNote'))}</div>
      </div>
    </div>`;

  const ogDesc = [w.destination ? clip(w.destination, 45) : '', range]
    .filter(Boolean)
    .join(' · ');

  return renderPage({
    lang,
    title: `${who} — Aihoy!`,
    ogTitle: w.destination ? `${who}: ${clip(w.destination, 45)}` : who,
    ogDesc: ogDesc || t(lang, 'windowOgFallback'),
    // Ha a létrehozó feltöltött egy ablak-képet (photo_url), AZ megy ki
    // social-előnézetnek is — ha nincs, marad az arculati kép (a shell()
    // esik vissza rá a _shared.js-ben).
    ogImage: w.photo_url || null,
    ogUrl: `https://aihoy.app/w/${token}`,
    // A megosztott ablak ne kerüljön keresőbe: a link címzetteknek szól.
    noindex: true,
    inner,
  });
}
