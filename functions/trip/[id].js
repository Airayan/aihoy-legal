// functions/trip/[id].js  →  aihoy.app/trip/<uuid>
//
// A túra NYERS id-vel érhető el, token nélkül: a túra hirdetés, és tudatos
// döntés, hogy nem csak a szervező oszthatja tovább. (2026-08-04)
//
// NYELV (2026-08-18): az oldal a LÁTOGATÓ böngészőnyelvén jelenik meg
// (Accept-Language → pickLang). A szervező saját szövege (cím, leírás,
// találkozási pont) marad úgy, ahogy beírták. Lásd _shared.js fejléc.

import {
  callRpc, esc, clip, fmtDateTime, renderPage, renderGone, PLAY_URL,
  pickLang, t, modeLabel,
} from '../_shared.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestGet({ params, env, request }) {
  const lang = pickLang(request);
  const id = String(params.id || '');

  // Formai szűrés MÉG a DB előtt: értelmetlen kérésekkel ne terheljük.
  if (!UUID_RE.test(id)) return renderGone('trip', lang);

  let tr;
  try {
    tr = await callRpc(env, 'get_public_trip', { p_trip_id: id });
  } catch (e) {
    // Ne bukjon némán, de a felhasználó se lásson technikai részletet.
    console.error('[trip]', e.message);
    return renderGone('trip', lang);
  }

  // Üres válasz = nincs ilyen túra, VAGY lejárt (end_date + 12 óra).
  if (!tr) return renderGone('trip', lang);

  const when = fmtDateTime(tr.start_date);
  const place = tr.port_name || tr.destination || '';
  const mode = modeLabel(lang, tr.trip_mode);

  // Ha a cím maga a módozat (gyakori: "Vitorlás bérlés kapitánnyal"), az alcím
  // csak megismételné. Egyszer kiírni elég.
  const showMode = mode && mode.trim() !== String(tr.title || '').trim();

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
  const started = tr.start_date
    ? Date.parse(tr.start_date) < Date.now()
    : false;

  // ── Ár ───────────────────────────────────────────────────────────────────
  // A price a TELJES hajó ára, a price_per_person ebből számolt becslés teli
  // hajóra. Ezt őszintén ki kell írni, különben a "75 €/fő" garantált árnak
  // látszik, pedig nem az.
  const sign = tr.currency === 'EUR' ? '€' : tr.currency || '';
  let priceHtml = '';
  if (tr.price > 0) {
    priceHtml = `
      <div class="price">
        <div class="big">${esc(Math.round(tr.price))} ${esc(sign)} ${esc(t(lang, 'tripPerBoat'))}</div>
        ${
          tr.price_per_person
            ? `<div class="note">${esc(t(lang, 'tripPerPersonNote', { price: tr.price_per_person, sign }))}</div>`
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
  if (tr.smoking_policy === 'no') tags.push(t(lang, 'tagNoSmoking'));
  if (Array.isArray(tr.child_age_groups) && tr.child_age_groups.length > 0) {
    tags.push(t(lang, 'tagChildFriendly'));
  }
  if (tr.license_required) tags.push(t(lang, 'tagLicense'));
  // ♀️ és 🗣️ — variánsjelölővel (U+FE0F), különben a böngésző
  // fekete-fehér szimbólumként rajzolja őket, nem színes emojiként.
  if (tr.gender_preference === 'women_only') tags.push(t(lang, 'tagWomenOnly'));
  if (Array.isArray(tr.languages) && tr.languages.length > 0) {
    tags.push('🗣️ ' + tr.languages.join(', '));
  }

  const rows = [];
  if (when) rows.push(['📅', when]);
  // A port_name szabad szöveg, néha nagyon hosszú — a kártyán rövidítjük,
  // a teljes szöveg úgyis ott van a leírásban.
  if (place) rows.push(['🧭', clip(place, 90)]);
  if (started) {
    // Elindult túránál a szabad helyek száma félrevezető: az app amúgy sem
    // enged rá foglalni (blocked = isPast || isFull).
    rows.push(['🚩', t(lang, 'tripStarted')]);
  } else if (typeof tr.free_seats === 'number') {
    rows.push([
      '👥',
      tr.free_seats > 0
        ? t(lang, 'tripFreeSeats', { free: tr.free_seats, cap: tr.capacity ?? '?' })
        : t(lang, 'tripFull'),
    ]);
  }
  // Cégnév a szervező FÖLÖTT: a cég az entitás, a személy a kapcsolattartó.
  // Magánszemélynél az RPC NULL-t ad (25_public_sharing_names.sql), így a sor
  // magától kimarad — nem kell külön ág.
  if (tr.company_name) rows.push(['🏢', clip(tr.company_name, 60)]);
  if (tr.organizer_name) rows.push(['👤', t(lang, 'tripOrganizer', { name: tr.organizer_name })]);

  const inner = `
    <div class="card">
      ${
        tr.image_url
          ? `<img class="hero" src="${esc(tr.image_url)}" alt="" loading="lazy">`
          : ''
      }
      <div class="body">
        <h1>${esc(tr.title)}</h1>
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
        ${tr.description ? `<div class="desc">${esc(tr.description)}</div>` : ''}
        ${
          tags.length
            ? `<div class="tags">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>`
            : ''
        }
        ${
          started
            ? `<a class="cta" href="${PLAY_URL}">${esc(t(lang, 'tripCtaStarted'))}</a>
        <div class="cta-note">${esc(t(lang, 'tripCtaStartedNote'))}</div>`
            : `<a class="cta" href="${PLAY_URL}">${esc(t(lang, 'tripCtaOpen'))}</a>
        <div class="cta-note">${esc(t(lang, 'tripCtaOpenNote'))}</div>`
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
    tr.destination ? clip(tr.destination, 40) : '',
    started
      ? t(lang, 'tripStartedShort')
      : typeof tr.free_seats === 'number' && tr.free_seats > 0
        ? t(lang, 'tripFreeSeatsShort', { free: tr.free_seats })
        : '',
    tr.price > 0 && tr.price_per_person
      ? t(lang, 'tripPerPersonShort', { price: tr.price_per_person, sign })
      : '',
    // Cégnév UTOLSÓNAK: bizalmi jel, de a dátumnál és az árnál kevésbé
    // csábító. Ha az előnézet túl hosszúra nyúlik, EZT a sort vedd ki elsőként.
    tr.company_name ? clip(tr.company_name, 30) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return renderPage({
    lang,
    title: `${tr.title} — Aihoy!`,
    ogTitle: tr.title,
    ogDesc: ogDesc || t(lang, 'tripOgFallback'),
    ogImage: tr.image_url,
    ogUrl: `https://aihoy.app/trip/${id}`,
    inner,
  });
}
