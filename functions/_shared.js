// functions/_shared.js
// ─────────────────────────────────────────────────────────────────────────────
// Közös segédek a megosztható túra- és utazásiablak-oldalakhoz.
//
// A "_" prefix miatt a Cloudflare Pages NEM teszi ki útvonalként — ez csak modul.
//
// FONTOS: itt CSAK az anon kulcsot használjuk. A szerveroldali szűrést a
// Supabase RPC-k végzik (24_public_sharing.sql), amik SECURITY DEFINER-ek és
// szűk mezőkészletet adnak vissza. Service-role kulcsra nincs szükség, és nem
// is szabad ide tenni.
// ─────────────────────────────────────────────────────────────────────────────

const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.aihoy.app';

// Ha egy túrának nincs fotója, ez az arculati kép megy az előnézetbe.
// (A repó gyökerében már ott van.)
const FALLBACK_OG = 'https://aihoy.app/og-image.png';

/**
 * Supabase RPC hívás. Hibát NEM nyel el némán: a hívó dönt, mit csinál vele.
 */
export async function callRpc(env, fnName, body) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Ez konfigurációs hiba, nem felhasználói. Legyen egyértelmű a logban.
    throw new Error(
      'Hiányzó SUPABASE_URL vagy SUPABASE_ANON_KEY környezeti változó.'
    );
  }

  const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`RPC ${fnName} hiba: ${res.status} ${await res.text()}`);
  }

  const rows = await res.json();
  // A két RPC RETURNS TABLE — tömböt ad vissza. Üres tömb = nincs/lejárt.
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/** HTML-escape. Minden felhasználói szöveg ezen megy át. */
export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Szöveg rövidítése szóhatáron — OG-leíráshoz és alcímhez. */
export function clip(s, max) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

/**
 * Dátumformázás. A timestamptz mezőket NYERSEN olvassuk (nem toLocaleString),
 * mert az app a túra helyszínének faliidejét tárolja UTC-nek álcázva — a nyers
 * olvasás adja vissza pontosan azt, amit a szervező beírt, és amit az appban is
 * lát mindenki. (Lásd a 2026-08-04-i vizsgálatot.)
 */
export function fmtDateTime(iso) {
  if (!iso) return '';
  const m = String(iso).match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/
  );
  if (!m) return '';
  return `${m[1]}. ${m[2]}. ${m[3]}. ${m[4]}:${m[5]}`;
}

/** Csak dátum (date oszlopokhoz: date_from / date_to). */
export function fmtDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[1]}. ${m[2]}. ${m[3]}.`;
}

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    background:#0A1628;color:#E8EEF5;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    line-height:1.55;min-height:100vh;
    display:flex;flex-direction:column;align-items:center;
    padding:24px 16px 48px;
  }
  .wrap{width:100%;max-width:560px}
  .brand{
    display:flex;align-items:center;gap:10px;
    font-weight:800;letter-spacing:.5px;color:#4FC3F7;
    margin-bottom:20px;font-size:17px;text-decoration:none;
  }
  /* A logó háttere ugyanaz a sötétkék, mint az oldalé, ezért nincs körülötte
     látható doboz. A border-radius csak a PNG sarkait kerekíti le. */
  .brand img{
    width:30px;height:30px;border-radius:8px;display:block;flex:none;
  }
  .brand:hover span{text-decoration:underline}
  .card{
    background:#12233A;border:1px solid #1E3A5C;border-radius:20px;
    overflow:hidden;
  }
  .hero{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#1E3A5C}
  .body{padding:20px}
  h1{font-size:21px;font-weight:800;line-height:1.3;margin-bottom:6px}
  .sub{color:#8FA8C0;font-size:13px;margin-bottom:16px}
  .rows{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
  .row{display:flex;gap:10px;font-size:15px;align-items:flex-start}
  .row .ico{width:22px;flex:none;text-align:center}
  .row .val{flex:1}
  .price{
    background:#0A1628;border:1px solid #1E3A5C;border-radius:12px;
    padding:12px 14px;margin-bottom:16px;
  }
  .price .big{font-size:20px;font-weight:800;color:#4FC3F7}
  .price .note{font-size:12px;color:#8FA8C0;margin-top:2px}
  .desc{
    color:#C3D3E3;font-size:14px;white-space:pre-wrap;
    border-top:1px solid #1E3A5C;padding-top:14px;margin-bottom:4px;
  }
  .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
  .tag{
    background:#0A1628;border:1px solid #1E3A5C;border-radius:999px;
    padding:4px 11px;font-size:12px;color:#8FA8C0;
  }
  .cta{
    display:block;margin-top:20px;padding:15px;border-radius:14px;
    background:#4FC3F7;color:#06121F;text-align:center;
    font-weight:800;font-size:16px;text-decoration:none;
  }
  .cta-note{text-align:center;color:#8FA8C0;font-size:12px;margin-top:10px}
  /* Másodlagos kijárat: aki még nem ismeri az appot, előbb megnézné.
     SZÁNDÉKOSAN keretes, nem kitöltött — a kék CTA marad a fő gomb.
     Két egyforma súlyú gomb közt az emberek nem választanak, hanem elmennek. */
  .learn{
    display:block;margin-top:16px;padding:13px;border-radius:14px;
    background:transparent;border:1px solid #2A4A70;
    color:#4FC3F7;text-align:center;
    font-weight:600;font-size:15px;text-decoration:none;
  }
  .learn:hover{background:#12233A}
  .gone{text-align:center;padding:44px 20px}
  .gone .em{font-size:44px;margin-bottom:14px}
  .gone h1{margin-bottom:8px}
  .gone p{color:#8FA8C0;font-size:15px}
  footer{margin-top:28px;text-align:center;color:#5E7A96;font-size:12px}
  footer a{color:#8FA8C0}
`;

function shell({ title, ogTitle, ogDesc, ogImage, ogUrl, noindex, inner }) {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(ogDesc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Aihoy!">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:image" content="${esc(ogImage || FALLBACK_OG)}">
${ogUrl ? `<meta property="og:url" content="${esc(ogUrl)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="/"><img src="/logo_512.png" alt="" width="30" height="30"><span>Aihoy!</span></a>
  ${inner}
  <a class="learn" href="/">Mi az az Aihoy? → aihoy.app</a>
  <footer>
    <a href="/privacy.html">Adatvédelem</a> ·
    <a href="/">aihoy.app</a>
  </footer>
</div>
</body>
</html>`;
}

export function renderPage(opts) {
  return new Response(shell(opts), {
    status: opts.status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Rövid cache: a szabad helyek és a lejárat változhat, de a Facebook
      // robotjának se kelljen minden kattintásnál a Supabase-t terhelnie.
      'cache-control': 'public, max-age=300',
    },
  });
}

/**
 * Lejárt / nem létező / visszavont tartalom.
 * Szándékosan NEM mondjuk meg, melyik eset áll fenn — kívülről nézve mindegy,
 * és így nem lehet a linkek létezésére következtetni.
 * noindex: a keresők ne indexeljék a halott oldalakat.
 */
export function renderGone(kind) {
  const isTrip = kind === 'trip';
  return renderPage({
    status: 404,
    noindex: true,
    title: 'Már nem elérhető — Aihoy!',
    ogTitle: 'Aihoy!',
    ogDesc: 'Vitorlázás, legénység, útitársak a Mediterráneumban és az Adrián.',
    inner: `
      <div class="card">
        <div class="body gone">
          <div class="em">⚓</div>
          <h1>Ez a ${isTrip ? 'túra' : 'megosztás'} már nem elérhető</h1>
          <p>Lehet, hogy lezajlott, vagy a megosztást visszavonták.
             Az aktuális programokat az appban találod.</p>
          <a class="cta" href="${PLAY_URL}">Aihoy! letöltése</a>
        </div>
      </div>`,
  });
}

export { PLAY_URL, FALLBACK_OG };
