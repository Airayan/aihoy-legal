// functions/trip/[id].js  →  aihoy.app/trip/<uuid>
//
// A túra NYERS id-vel érhető el, token nélkül: a túra hirdetés, és tudatos
// döntés, hogy nem csak a szervező oszthatja tovább. (2026-08-04)

import {
  callRpc, esc, clip, fmtDateTime, renderPage, renderGone, PLAY_URL,
} from '../_shared.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODE_LABEL = {
  skippered: 'Vitorlás bérlés kapitánnyal',
  bareboat: 'Hajóbérlés kapitány nélkül',
  crew_finding: 'Legénységet keres',
  charter_host: 'Charter program',
};

export async function onRequestGet({ params, env }) {
  const id = String(params.id || '');

  // Formai szűrés MÉG a DB előtt: értelmetlen kérésekkel ne terheljük.
  if (!UUID_RE.test(id)) return renderGone('trip');

  let t;
  try {
    t = await callRpc(env, 'get_public_trip', { p_trip_id: id });
  } catch (e) {
    // Ne bukjon némán, de a felhasználó se lásson technikai részletet.
    console.error('[trip]', e.message);
    return renderGone('trip');
  }

  // Üres válasz = nincs ilyen túra, VAGY lejárt (end_date + 12 óra).
  if (!t) return renderGone('trip');

  const when = fmtDateTime(t.start_date);
  const place = t.port_name || t.destination || '';
  const mode = MODE_LABEL[t.trip_mode] || '';

  // Ha a cím maga a módozat (gyakori: "Vitorlás bérlés kapitánnyal"), az alcím
  // csak megismételné. Egyszer kiírni elég.
  const showMode = mode && mode.trim() !== String(t.title || '').trim();

  // ── ELINDULT-E MÁR? ──────────────────────────────────────────────────────
  // A link end_date + 12 óráig él, de többnapos túránál keletkezik egy ablak,
  // amikor a hajó már kint van a vízen, a linket viszont még osztogatják.
  // Ott a "4 szabad hely" + foglalásra hívó gomb hazugság lenne.
  //
  // A képlet SZÁNDÉKOSAN azonos a trip_details_sheet.dart:1320 sorával:
  //     trip.startTime.toUtc().isBefore(DateTime.now().toUtc())
  // Az időzóna-pontatlanságot (a start_date a helyszín faliórája UTC-nek
  // álcázva) NEM javítjuk ki itt: ha a weboldal más eredményre jutna, mint az
  // app, az rosszabb lenne, mint maga a pontatlanság.
  const started = t.start_date
    ? Date.parse(t.start_date) < Date.now()
    : false;

  // ── Ár ───────────────────────────────────────────────────────────────────
  // A price a TELJES hajó ára, a price_per_person ebből számolt becslés teli
  // hajóra. Ezt őszintén ki kell írni, különben a "75 €/fő" garantált árnak
  // látszik, pedig nem az.
  const sign = t.currency === 'EUR' ? '€' : t.currency || '';
  let priceHtml = '';
  if (t.price > 0) {
    priceHtml = `
      <div class="price">
        <div class="big">${esc(Math.round(t.price))} ${esc(sign)} / hajó</div>
        ${
          t.price_per_person
            ? `<div class="note">kb. ${esc(t.price_per_person)} ${esc(sign)}/fő teljes hajó esetén</div>`
            : ''
        }
      </div>`;
  }

  // ── Tényszerű jelzések ───────────────────────────────────────────────────
  // Ezek TÁJÉKOZTATNAK, nem szűrnek. A weboldal soha nem mond nemet: aki nem
  // illik bele, azt majd az app szűri — itt csak lássa előre, mire számítson.
  const tags = [];
  // A módozat NEM kerül a címkék közé: már ott van alcímként, közvetlenül a
  // cím alatt. Kétszer kiírva zajjá válik a többi, valóban új információt
  // hordozó jelzés (nemdohányzó, gyerekbarát, nyelvek) mellett.
  if (t.smoking_policy === 'no') tags.push('🚭 nemdohányzó');
  if (Array.isArray(t.child_age_groups) && t.child_age_groups.length > 0) {
    tags.push('👶 gyerekbarát');
  }
  if (t.license_required) tags.push('📄 jogosítvány szükséges');
  // ♀️ és 🗣️ — variánsjelölővel (U+FE0F), különben a böngésző
  // fekete-fehér szimbólumként rajzolja őket, nem színes emojiként.
  if (t.gender_preference === 'women_only') tags.push('♀️ csak nőknek');
  if (Array.isArray(t.languages) && t.languages.length > 0) {
    tags.push('🗣️ ' + t.languages.join(', '));
  }

  const rows = [];
  if (when) rows.push(['📅', when]);
  // A port_name szabad szöveg, néha nagyon hosszú — a kártyán rövidítjük,
  // a teljes szöveg úgyis ott van a leírásban.
  if (place) rows.push(['🧭', clip(place, 90)]);
  if (started) {
    // Elindult túránál a szabad helyek száma félrevezető: az app amúgy sem
    // enged rá foglalni (blocked = isPast || isFull).
    rows.push(['🚩', 'Ez a túra már elindult']);
  } else if (typeof t.free_seats === 'number') {
    rows.push([
      '👥',
      t.free_seats > 0
        ? `${t.free_seats} szabad hely a ${t.capacity ?? '?'} főből`
        : 'Betelt',
    ]);
  }
  // Cégnév a szervező FÖLÖTT: a cég az entitás, a személy a kapcsolattartó.
  // Magánszemélynél az RPC NULL-t ad (25_public_sharing_names.sql), így a sor
  // magától kimarad — nem kell külön ág.
  if (t.company_name) rows.push(['🏢', clip(t.company_name, 60)]);
  if (t.organizer_name) rows.push(['👤', `Szervező: ${t.organizer_name}`]);

  const inner = `
    <div class="card">
      ${
        t.image_url
          ? `<img class="hero" src="${esc(t.image_url)}" alt="" loading="lazy">`
          : ''
      }
      <div class="body">
        <h1>${esc(t.title)}</h1>
        ${showMode ? `<div class="sub">${esc(mode)}</div>` : ''}
        <div class="rows">
          ${rows
            .map(
              ([ico, val]) =>
                `<div class="row"><span class="ico">${ico}</span><span class="val">${esc(val)}</span></div>`
            )
            .join('')}
        </div>
        ${priceHtml}
        ${t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}
        ${
          tags.length
            ? `<div class="tags">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>`
            : ''
        }
        ${
          started
            ? `<a class="cta" href="${PLAY_URL}">Aktuális programok az Aihoy!-ban</a>
        <div class="cta-note">Erre a túrára már nem lehet jelentkezni.</div>`
            : `<a class="cta" href="${PLAY_URL}">Megnyitás az Aihoy! appban</a>
        <div class="cta-note">Jelentkezés és üzenetváltás az appban.</div>`
        }
      </div>
    </div>`;

  // OG-leírás: a legfontosabb tények egy sorban, mert a Facebook ennyit mutat.
  //
  // A port_name SZÁNDÉKOSAN nincs benne. Az az űrlapon kötelező, szabad szöveges
  // TALÁLKOZÁSI PONT ("a büfé előtt a gesztenyefánál"), tehát működési részlet,
  // nem csábító információ — az előnézetben csak elvenné a helyet a lényeg elől.
  // Az oldalon természetesen ott marad a 🧭 sorban.
  // A túra neve amúgy is a legkiemeltebb elem: az az og:title.
  const ogDesc = [
    when,
    // A destination (város/térség) viszont mehet, ha ki van töltve: az valódi
    // helyinformáció, nem útbaigazítás.
    t.destination ? clip(t.destination, 40) : '',
    started
      ? 'Már elindult'
      : typeof t.free_seats === 'number' && t.free_seats > 0
        ? `${t.free_seats} szabad hely`
        : '',
    t.price > 0 && t.price_per_person ? `kb. ${t.price_per_person} ${sign}/fő` : '',
    // Cégnév UTOLSÓNAK: bizalmi jel, de a dátumnál és az árnál kevésbé
    // csábító. Ha az előnézet túl hosszúra nyúlik, EZT a sort vedd ki elsőként.
    t.company_name ? clip(t.company_name, 30) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return renderPage({
    title: `${t.title} — Aihoy!`,
    ogTitle: t.title,
    ogDesc: ogDesc || 'Nézd meg ezt a programot az Aihoy!-ban.',
    ogImage: t.image_url,
    ogUrl: `https://aihoy.app/trip/${id}`,
    inner,
  });
}
