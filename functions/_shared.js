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
//
// TÖBBNYELVŰSÉG (2026-08-18)
// ──────────────────────────
// Az oldal nyelvét a LÁTOGATÓ böngészője dönti el (Accept-Language), NEM a
// linket létrehozó felhasználó app-nyelve. Két oka van:
//   1. A létrehozó app-nyelve sehol nincs eltárolva (a Flutter oldalon a
//      localeResolutionCallback futásidőben az eszköz rendszernyelvéből
//      dolgozik, a profiles táblán nincs locale mező) — szerveroldalról tehát
//      nem is elérhető.
//   2. Ez amúgy is a helyes webes minta (Airbnb/Booking ugyanígy): a felület
//      a NÉZŐ nyelvén van, a felhasználó saját szövege (leírás, úti cél)
//      viszont marad azon a nyelven, ahogy beírták. A kettő keveredése nem
//      hiba, hanem elvárt viselkedés.
// Ismeretlen/nem támogatott nyelv → ANGOL (semlegesebb egy külföldi
// látogatónak, mint a magyar).
// ─────────────────────────────────────────────────────────────────────────────

const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.aihoy.app';

// Ha egy túrának nincs fotója, ez az arculati kép megy az előnézetbe.
// (A repó gyökerében már ott van.)
const FALLBACK_OG = 'https://aihoy.app/og-image.png';

// A 7 app-nyelv — SZÁNDÉKOSAN ugyanaz a lista, mint a main.dart
// supportedLocales-e. Ha ott bővül, ide is fel kell venni.
const SUPPORTED_LANGS = ['hu', 'en', 'hr', 'el', 'pl', 'de', 'it'];
const DEFAULT_LANG = 'en';

/**
 * Accept-Language fejléc → a legjobb támogatott nyelv kódja.
 * Kezeli a q-értékeket ("hu-HU,hu;q=0.9,en;q=0.8") és a régió-utótagot
 * ("de-AT" → "de"). Ha semmi nem illik, DEFAULT_LANG.
 */
export function pickLang(request) {
  try {
    const header = request?.headers?.get('accept-language') || '';
    if (!header) return DEFAULT_LANG;

    const ranked = header
      .split(',')
      .map((part) => {
        const [tagRaw, ...params] = part.trim().split(';');
        const tag = (tagRaw || '').trim().toLowerCase();
        const qParam = params.find((p) => p.trim().startsWith('q='));
        const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
        return { tag, q: Number.isFinite(q) ? q : 0 };
      })
      .filter((x) => x.tag && x.tag !== '*')
      .sort((a, b) => b.q - a.q);

    for (const { tag } of ranked) {
      const base = tag.split('-')[0];
      if (SUPPORTED_LANGS.includes(base)) return base;
    }
  } catch (_e) {
    // Fejléc-hiba nem érhet oldalt: essünk vissza az alapértelmezettre.
  }
  return DEFAULT_LANG;
}

// ── Szótár ───────────────────────────────────────────────────────────────────
// Minden felületi szöveg innen jön. A {param} helyőrzőket a tpl() tölti ki.
const DICT = {
  hu: {
    learnMore: 'Mi az az Aihoy? → aihoy.app',
    privacy: 'Adatvédelem',
    goneTitleTrip: 'Ez a túra már nem elérhető',
    goneTitleWindow: 'Ez a megosztás már nem elérhető',
    goneBody: 'Lehet, hogy lezajlott, vagy a megosztást visszavonták. Az aktuális programokat az appban találod.',
    goneCta: 'Aihoy! letöltése',
    gonePageTitle: 'Már nem elérhető — Aihoy!',
    brandTagline: 'Vitorlázás, legénység, útitársak a Mediterráneumban és az Adrián.',
    // ── utazási ablak ──
    windowWho: '{name} utazása',
    windowWhoFallback: 'Utazás',
    windowSub: 'Utazási ablak — ki lesz ott ugyanakkor?',
    windowCta: 'Csatlakozom az Aihoy!-hoz',
    windowCtaNote: 'Az appban látod, ki lesz még ott ugyanekkor.',
    windowOgFallback: 'Nézd meg az Aihoy!-ban.',
    // ── túra ──
    tripStarted: 'Ez a túra már elindult',
    tripStartedShort: 'Már elindult',
    tripFreeSeats: '{free} szabad hely a {cap} főből',
    tripFreeSeatsShort: '{free} szabad hely',
    tripFull: 'Betelt',
    tripOrganizer: 'Szervező: {name}',
    tripPerBoat: '/ hajó',
    tripPerPersonNote: 'kb. {price} {sign}/fő teljes hajó esetén',
    tripPerPersonShort: 'kb. {price} {sign}/fő',
    tripCtaOpen: 'Megnyitás az Aihoy! appban',
    tripCtaOpenNote: 'Jelentkezés és üzenetváltás az appban.',
    tripCtaStarted: 'Aktuális programok az Aihoy!-ban',
    tripCtaStartedNote: 'Erre a túrára már nem lehet jelentkezni.',
    tripFromPerPerson: '{price} {sign}/fő-től',
    tripFromPerPersonShort: '{price} {sign}/fő-től',
    tripTieredNote: 'A hajó díja a létszámtól függ — ez a legkedvezőbb, teli hajós ár.',
    tripOgFallback: 'Nézd meg ezt a programot az Aihoy!-ban.',
    tagNoSmoking: '🚭 nemdohányzó',
    tagChildFriendly: '👶 gyerekbarát',
    tagLicense: '📄 jogosítvány szükséges',
    tagWomenOnly: '♀️ csak nőknek',
    modeSkippered: 'Vitorlás bérlés kapitánnyal',
    modeBareboat: 'Hajóbérlés kapitány nélkül',
    modeCrewFinding: 'Legénységet keres',
    modeCharterHost: 'Charter program',
    actSailing: '⛵ Hajózás', actDiving: '🤿 Búvárkodás', actSnorkeling: '🥽 Snorkeling',
    actFishing: '🎣 Horgászat', actWhale: '🐋 Bálnales', actKayak: '🛶 Kajak',
    actBeach: '🏖️ Strand', actCulture: '🏛️ Kultúra', actRuins: '🏺 Romkereső',
    actHiking: '🥾 Gyaloglás', actCycling: '🚴 Kerékpározás', actFood: '🍽️ Gasztro',
    actNightlife: '🎉 Szórakozás', actBaby: '👶 Kisgyerekes',
    actParty: '🎉 Buli', actSurf: '🏄 Szörf', actWakeboard: '🏄 Wakeboard',
  },
  en: {
    learnMore: 'What is Aihoy? → aihoy.app',
    privacy: 'Privacy',
    goneTitleTrip: 'This trip is no longer available',
    goneTitleWindow: 'This share is no longer available',
    goneBody: 'It may have already taken place, or the share was revoked. You can find current plans in the app.',
    goneCta: 'Download Aihoy!',
    gonePageTitle: 'No longer available — Aihoy!',
    brandTagline: 'Sailing, crew and travel companions across the Mediterranean and the Adriatic.',
    windowWho: "{name}'s trip",
    windowWhoFallback: 'Travel plan',
    windowSub: 'Travel window — who else will be there?',
    windowCta: 'Join Aihoy!',
    windowCtaNote: 'See in the app who else will be around at the same time.',
    windowOgFallback: 'Take a look on Aihoy!',
    tripStarted: 'This trip has already departed',
    tripStartedShort: 'Already departed',
    tripFreeSeats: '{free} seats left of {cap}',
    tripFreeSeatsShort: '{free} seats left',
    tripFull: 'Fully booked',
    tripOrganizer: 'Organizer: {name}',
    tripPerBoat: '/ boat',
    tripPerPersonNote: 'approx. {price} {sign}/person with a full boat',
    tripPerPersonShort: 'approx. {price} {sign}/person',
    tripCtaOpen: 'Open in the Aihoy! app',
    tripCtaOpenNote: 'Booking and messaging happen in the app.',
    tripCtaStarted: 'Current plans on Aihoy!',
    tripCtaStartedNote: 'This trip can no longer be booked.',
    tripFromPerPerson: 'from {price} {sign}/person',
    tripFromPerPersonShort: 'from {price} {sign}/person',
    tripTieredNote: 'The boat fee depends on how many of you there are — this is the best case, with a full boat.',
    tripOgFallback: 'Take a look at this trip on Aihoy!',
    tagNoSmoking: '🚭 non-smoking',
    tagChildFriendly: '👶 child-friendly',
    tagLicense: '📄 licence required',
    tagWomenOnly: '♀️ women only',
    modeSkippered: 'Yacht charter with skipper',
    modeBareboat: 'Bareboat charter',
    modeCrewFinding: 'Looking for crew',
    modeCharterHost: 'Charter programme',
    actSailing: '⛵ Sailing', actDiving: '🤿 Diving', actSnorkeling: '🥽 Snorkelling',
    actFishing: '🎣 Fishing', actWhale: '🐋 Whale watching', actKayak: '🛶 Kayaking',
    actBeach: '🏖️ Beach', actCulture: '🏛️ Culture', actRuins: '🏺 Ruins',
    actHiking: '🥾 Hiking', actCycling: '🚴 Cycling', actFood: '🍽️ Food',
    actNightlife: '🎉 Nightlife', actBaby: '👶 With small children',
    actParty: '🎉 Party', actSurf: '🏄 Surfing', actWakeboard: '🏄 Wakeboarding',
  },
  hr: {
    learnMore: 'Što je Aihoy? → aihoy.app',
    privacy: 'Privatnost',
    goneTitleTrip: 'Ovaj izlet više nije dostupan',
    goneTitleWindow: 'Ovo dijeljenje više nije dostupno',
    goneBody: 'Možda je već prošao ili je dijeljenje povučeno. Aktualne planove pronađi u aplikaciji.',
    goneCta: 'Preuzmi Aihoy!',
    gonePageTitle: 'Više nije dostupno — Aihoy!',
    brandTagline: 'Jedrenje, posada i suputnici na Mediteranu i Jadranu.',
    windowWho: 'Putovanje — {name}',
    windowWhoFallback: 'Putovanje',
    windowSub: 'Putni prozor — tko će još biti ondje?',
    windowCta: 'Pridružujem se Aihoy!',
    windowCtaNote: 'U aplikaciji vidiš tko će još biti ondje u isto vrijeme.',
    windowOgFallback: 'Pogledaj na Aihoy!',
    tripStarted: 'Ovaj izlet je već krenuo',
    tripStartedShort: 'Već krenuo',
    tripFreeSeats: '{free} slobodnih mjesta od {cap}',
    tripFreeSeatsShort: '{free} slobodnih mjesta',
    tripFull: 'Popunjeno',
    tripOrganizer: 'Organizator: {name}',
    tripPerBoat: '/ brod',
    tripPerPersonNote: 'cca. {price} {sign}/osobi uz puni brod',
    tripPerPersonShort: 'cca. {price} {sign}/osobi',
    tripCtaOpen: 'Otvori u Aihoy! aplikaciji',
    tripCtaOpenNote: 'Prijava i poruke idu preko aplikacije.',
    tripCtaStarted: 'Aktualni planovi na Aihoy!',
    tripCtaStartedNote: 'Na ovaj izlet više se nije moguće prijaviti.',
    tripFromPerPerson: 'od {price} {sign}/os.',
    tripFromPerPersonShort: 'od {price} {sign}/os.',
    tripTieredNote: 'Cijena broda ovisi o broju putnika — ovo je najpovoljnija cijena, uz pun brod.',
    tripOgFallback: 'Pogledaj ovaj izlet na Aihoy!',
    tagNoSmoking: '🚭 nepušački',
    tagChildFriendly: '👶 prilagođeno djeci',
    tagLicense: '📄 potrebna dozvola',
    tagWomenOnly: '♀️ samo za žene',
    modeSkippered: 'Najam jedrilice sa skiperom',
    modeBareboat: 'Najam broda bez skipera',
    modeCrewFinding: 'Traži posadu',
    modeCharterHost: 'Charter program',
    actSailing: '⛵ Jedrenje', actDiving: '🤿 Ronjenje', actSnorkeling: '🥽 Ronjenje na dah',
    actFishing: '🎣 Ribolov', actWhale: '🐋 Promatranje kitova', actKayak: '🛶 Kajak',
    actBeach: '🏖️ Plaža', actCulture: '🏛️ Kultura', actRuins: '🏺 Ruševine',
    actHiking: '🥾 Pješačenje', actCycling: '🚴 Biciklizam', actFood: '🍽️ Gastro',
    actNightlife: '🎉 Izlasci', actBaby: '👶 S malom djecom',
    actParty: '🎉 Party', actSurf: '🏄 Surfanje', actWakeboard: '🏄 Wakeboard',
  },
  el: {
    learnMore: 'Τι είναι το Aihoy; → aihoy.app',
    privacy: 'Απόρρητο',
    goneTitleTrip: 'Αυτή η εκδρομή δεν είναι πλέον διαθέσιμη',
    goneTitleWindow: 'Αυτή η κοινοποίηση δεν είναι πλέον διαθέσιμη',
    goneBody: 'Μπορεί να έχει ήδη πραγματοποιηθεί ή η κοινοποίηση να ανακλήθηκε. Θα βρεις τα τρέχοντα προγράμματα στην εφαρμογή.',
    goneCta: 'Κατέβασε το Aihoy!',
    gonePageTitle: 'Μη διαθέσιμο πλέον — Aihoy!',
    brandTagline: 'Ιστιοπλοΐα, πλήρωμα και συνταξιδιώτες στη Μεσόγειο και την Αδριατική.',
    windowWho: 'Το ταξίδι του/της {name}',
    windowWhoFallback: 'Ταξίδι',
    windowSub: 'Ταξιδιωτικό παράθυρο — ποιος άλλος θα είναι εκεί;',
    windowCta: 'Μπαίνω στο Aihoy!',
    windowCtaNote: 'Στην εφαρμογή βλέπεις ποιος άλλος θα βρίσκεται εκεί την ίδια περίοδο.',
    windowOgFallback: 'Ρίξε μια ματιά στο Aihoy!',
    tripStarted: 'Αυτή η εκδρομή έχει ήδη ξεκινήσει',
    tripStartedShort: 'Έχει ήδη ξεκινήσει',
    tripFreeSeats: '{free} ελεύθερες θέσεις από {cap}',
    tripFreeSeatsShort: '{free} ελεύθερες θέσεις',
    tripFull: 'Πλήρες',
    tripOrganizer: 'Διοργανωτής: {name}',
    tripPerBoat: '/ σκάφος',
    tripPerPersonNote: 'περίπου {price} {sign}/άτομο με πλήρες σκάφος',
    tripPerPersonShort: 'περίπου {price} {sign}/άτομο',
    tripCtaOpen: 'Άνοιγμα στην εφαρμογή Aihoy!',
    tripCtaOpenNote: 'Η κράτηση και τα μηνύματα γίνονται στην εφαρμογή.',
    tripCtaStarted: 'Τρέχοντα προγράμματα στο Aihoy!',
    tripCtaStartedNote: 'Δεν είναι πλέον δυνατή η κράτηση σε αυτή την εκδρομή.',
    tripFromPerPerson: 'από {price} {sign}/άτομο',
    tripFromPerPersonShort: 'από {price} {sign}/άτομο',
    tripTieredNote: 'Η τιμή του σκάφους εξαρτάται από τον αριθμό των ατόμων — αυτή είναι η καλύτερη τιμή, με πλήρες σκάφος.',
    tripOgFallback: 'Δες αυτό το πρόγραμμα στο Aihoy!',
    tagNoSmoking: '🚭 μη καπνιστές',
    tagChildFriendly: '👶 φιλικό για παιδιά',
    tagLicense: '📄 απαιτείται δίπλωμα',
    tagWomenOnly: '♀️ μόνο για γυναίκες',
    modeSkippered: 'Ενοικίαση ιστιοπλοϊκού με κυβερνήτη',
    modeBareboat: 'Ενοικίαση σκάφους χωρίς κυβερνήτη',
    modeCrewFinding: 'Αναζήτηση πληρώματος',
    modeCharterHost: 'Πρόγραμμα charter',
    actSailing: '⛵ Ιστιοπλοΐα', actDiving: '🤿 Καταδύσεις', actSnorkeling: '🥽 Snorkeling',
    actFishing: '🎣 Ψάρεμα', actWhale: '🐋 Παρατήρηση φαλαινών', actKayak: '🛶 Καγιάκ',
    actBeach: '🏖️ Παραλία', actCulture: '🏛️ Πολιτισμός', actRuins: '🏺 Αρχαία ερείπια',
    actHiking: '🥾 Πεζοπορία', actCycling: '🚴 Ποδηλασία', actFood: '🍽️ Γαστρονομία',
    actNightlife: '🎉 Διασκέδαση', actBaby: '👶 Με μικρά παιδιά',
    actParty: '🎉 Πάρτι', actSurf: '🏄 Σέρφινγκ', actWakeboard: '🏄 Wakeboard',
  },
  pl: {
    learnMore: 'Czym jest Aihoy? → aihoy.app',
    privacy: 'Prywatność',
    goneTitleTrip: 'Ten rejs nie jest już dostępny',
    goneTitleWindow: 'To udostępnienie nie jest już dostępne',
    goneBody: 'Mógł się już odbyć albo udostępnienie zostało wycofane. Aktualne plany znajdziesz w aplikacji.',
    goneCta: 'Pobierz Aihoy!',
    gonePageTitle: 'Już niedostępne — Aihoy!',
    brandTagline: 'Żeglarstwo, załoga i towarzysze podróży na Morzu Śródziemnym i Adriatyku.',
    windowWho: 'Podróż — {name}',
    windowWhoFallback: 'Podróż',
    windowSub: 'Okno podróży — kto jeszcze tam będzie?',
    windowCta: 'Dołączam do Aihoy!',
    windowCtaNote: 'W aplikacji zobaczysz, kto jeszcze będzie tam w tym samym czasie.',
    windowOgFallback: 'Zobacz w Aihoy!',
    tripStarted: 'Ten rejs już wypłynął',
    tripStartedShort: 'Już wypłynął',
    tripFreeSeats: '{free} wolnych miejsc z {cap}',
    tripFreeSeatsShort: '{free} wolnych miejsc',
    tripFull: 'Komplet',
    tripOrganizer: 'Organizator: {name}',
    tripPerBoat: '/ łódź',
    tripPerPersonNote: 'ok. {price} {sign}/os. przy pełnej łodzi',
    tripPerPersonShort: 'ok. {price} {sign}/os.',
    tripCtaOpen: 'Otwórz w aplikacji Aihoy!',
    tripCtaOpenNote: 'Zgłoszenia i wiadomości w aplikacji.',
    tripCtaStarted: 'Aktualne plany w Aihoy!',
    tripCtaStartedNote: 'Na ten rejs nie można się już zapisać.',
    tripFromPerPerson: 'od {price} {sign}/os.',
    tripFromPerPersonShort: 'od {price} {sign}/os.',
    tripTieredNote: 'Cena łodzi zależy od liczby osób — to najkorzystniejsza cena, przy pełnej łodzi.',
    tripOgFallback: 'Zobacz ten rejs w Aihoy!',
    tagNoSmoking: '🚭 dla niepalących',
    tagChildFriendly: '👶 przyjazny dzieciom',
    tagLicense: '📄 wymagany patent',
    tagWomenOnly: '♀️ tylko dla kobiet',
    modeSkippered: 'Czarter jachtu ze sternikiem',
    modeBareboat: 'Czarter bez sternika',
    modeCrewFinding: 'Szuka załogi',
    modeCharterHost: 'Program czarterowy',
    actSailing: '⛵ Żeglarstwo', actDiving: '🤿 Nurkowanie', actSnorkeling: '🥽 Snorkeling',
    actFishing: '🎣 Wędkarstwo', actWhale: '🐋 Obserwacja wielorybów', actKayak: '🛶 Kajak',
    actBeach: '🏖️ Plaża', actCulture: '🏛️ Kultura', actRuins: '🏺 Ruiny',
    actHiking: '🥾 Wędrówki', actCycling: '🚴 Rower', actFood: '🍽️ Gastronomia',
    actNightlife: '🎉 Życie nocne', actBaby: '👶 Z małymi dziećmi',
    actParty: '🎉 Impreza', actSurf: '🏄 Surfing', actWakeboard: '🏄 Wakeboard',
  },
  de: {
    learnMore: 'Was ist Aihoy? → aihoy.app',
    privacy: 'Datenschutz',
    goneTitleTrip: 'Diese Tour ist nicht mehr verfügbar',
    goneTitleWindow: 'Diese Freigabe ist nicht mehr verfügbar',
    goneBody: 'Sie hat vielleicht schon stattgefunden, oder die Freigabe wurde zurückgezogen. Aktuelle Programme findest du in der App.',
    goneCta: 'Aihoy! herunterladen',
    gonePageTitle: 'Nicht mehr verfügbar — Aihoy!',
    brandTagline: 'Segeln, Crew und Reisebegleitung im Mittelmeer und in der Adria.',
    windowWho: 'Reise von {name}',
    windowWhoFallback: 'Reise',
    windowSub: 'Reisefenster — wer ist zur gleichen Zeit dort?',
    windowCta: 'Ich mache bei Aihoy! mit',
    windowCtaNote: 'In der App siehst du, wer sonst noch zur gleichen Zeit dort ist.',
    windowOgFallback: 'Schau es dir auf Aihoy! an.',
    tripStarted: 'Diese Tour ist bereits gestartet',
    tripStartedShort: 'Bereits gestartet',
    tripFreeSeats: '{free} freie Plätze von {cap}',
    tripFreeSeatsShort: '{free} freie Plätze',
    tripFull: 'Ausgebucht',
    tripOrganizer: 'Veranstalter: {name}',
    tripPerBoat: '/ Boot',
    tripPerPersonNote: 'ca. {price} {sign}/Person bei vollem Boot',
    tripPerPersonShort: 'ca. {price} {sign}/Person',
    tripCtaOpen: 'In der Aihoy!-App öffnen',
    tripCtaOpenNote: 'Buchung und Nachrichten laufen über die App.',
    tripCtaStarted: 'Aktuelle Programme auf Aihoy!',
    tripCtaStartedNote: 'Für diese Tour ist keine Anmeldung mehr möglich.',
    tripFromPerPerson: 'ab {price} {sign}/Person',
    tripFromPerPersonShort: 'ab {price} {sign}/Person',
    tripTieredNote: 'Der Bootspreis hängt von der Personenzahl ab — das ist der günstigste Fall, bei vollem Boot.',
    tripOgFallback: 'Sieh dir dieses Programm auf Aihoy! an.',
    tagNoSmoking: '🚭 Nichtraucher',
    tagChildFriendly: '👶 kinderfreundlich',
    tagLicense: '📄 Führerschein erforderlich',
    tagWomenOnly: '♀️ nur für Frauen',
    modeSkippered: 'Yachtcharter mit Skipper',
    modeBareboat: 'Bootscharter ohne Skipper',
    modeCrewFinding: 'Sucht Crew',
    modeCharterHost: 'Charter-Programm',
    actSailing: '⛵ Segeln', actDiving: '🤿 Tauchen', actSnorkeling: '🥽 Schnorcheln',
    actFishing: '🎣 Angeln', actWhale: '🐋 Walbeobachtung', actKayak: '🛶 Kajak',
    actBeach: '🏖️ Strand', actCulture: '🏛️ Kultur', actRuins: '🏺 Ruinen',
    actHiking: '🥾 Wandern', actCycling: '🚴 Radfahren', actFood: '🍽️ Kulinarik',
    actNightlife: '🎉 Nachtleben', actBaby: '👶 Mit Kleinkindern',
    actParty: '🎉 Party', actSurf: '🏄 Surfen', actWakeboard: '🏄 Wakeboard',
  },
  it: {
    learnMore: "Cos'è Aihoy? → aihoy.app",
    privacy: 'Privacy',
    goneTitleTrip: 'Questa gita non è più disponibile',
    goneTitleWindow: 'Questa condivisione non è più disponibile',
    goneBody: 'Potrebbe essersi già svolta, oppure la condivisione è stata revocata. Trovi i programmi attuali nell\'app.',
    goneCta: 'Scarica Aihoy!',
    gonePageTitle: 'Non più disponibile — Aihoy!',
    brandTagline: 'Vela, equipaggio e compagni di viaggio nel Mediterraneo e nell\'Adriatico.',
    windowWho: 'Il viaggio di {name}',
    windowWhoFallback: 'Viaggio',
    windowSub: 'Finestra di viaggio — chi altro ci sarà?',
    windowCta: 'Mi unisco ad Aihoy!',
    windowCtaNote: "Nell'app vedi chi altro ci sarà nello stesso periodo.",
    windowOgFallback: 'Dai un\'occhiata su Aihoy!',
    tripStarted: 'Questa gita è già partita',
    tripStartedShort: 'Già partita',
    tripFreeSeats: '{free} posti liberi su {cap}',
    tripFreeSeatsShort: '{free} posti liberi',
    tripFull: 'Al completo',
    tripOrganizer: 'Organizzatore: {name}',
    tripPerBoat: '/ barca',
    tripPerPersonNote: 'circa {price} {sign}/persona a barca piena',
    tripPerPersonShort: 'circa {price} {sign}/persona',
    tripCtaOpen: "Apri nell'app Aihoy!",
    tripCtaOpenNote: "Prenotazioni e messaggi avvengono nell'app.",
    tripCtaStarted: 'Programmi attuali su Aihoy!',
    tripCtaStartedNote: 'Non è più possibile iscriversi a questa gita.',
    tripFromPerPerson: 'da {price} {sign}/persona',
    tripFromPerPersonShort: 'da {price} {sign}/persona',
    tripTieredNote: 'Il prezzo della barca dipende dal numero di persone — questo è il caso migliore, a barca piena.',
    tripOgFallback: 'Guarda questo programma su Aihoy!',
    tagNoSmoking: '🚭 non fumatori',
    tagChildFriendly: '👶 adatto ai bambini',
    tagLicense: '📄 patente richiesta',
    tagWomenOnly: '♀️ solo donne',
    modeSkippered: 'Noleggio barca a vela con skipper',
    modeBareboat: 'Noleggio barca senza skipper',
    modeCrewFinding: 'Cerca equipaggio',
    modeCharterHost: 'Programma charter',
    actSailing: '⛵ Vela', actDiving: '🤿 Immersioni', actSnorkeling: '🥽 Snorkeling',
    actFishing: '🎣 Pesca', actWhale: '🐋 Avvistamento balene', actKayak: '🛶 Kayak',
    actBeach: '🏖️ Spiaggia', actCulture: '🏛️ Cultura', actRuins: '🏺 Rovine',
    actHiking: '🥾 Escursioni', actCycling: '🚴 Ciclismo', actFood: '🍽️ Gastronomia',
    actNightlife: '🎉 Vita notturna', actBaby: '👶 Con bambini piccoli',
    actParty: '🎉 Festa', actSurf: '🏄 Surf', actWakeboard: '🏄 Wakeboard',
  },
};

/**
 * Fordítás-lekérő. Ismeretlen kulcsnál MAGÁT A KULCSOT adja vissza (nem dob,
 * nem tüntet el semmit) — így egy elfelejtett fordítás látható hiba lesz, nem
 * néma üres string. Ismeretlen nyelvnél angolra esik vissza.
 */
export function t(lang, key, params) {
  const table = DICT[lang] || DICT[DEFAULT_LANG];
  const raw = table[key] ?? DICT[DEFAULT_LANG][key] ?? key;
  if (!params) return raw;
  return String(raw).replace(/\{(\w+)\}/g, (_, k) => `${params[k] ?? ''}`);
}

/** Tevékenység-kulcs (DB-érték) → lefordított címke. Ismeretlen kulcs marad nyersen. */
export function activityLabel(lang, key) {
  const map = {
    sailing: 'actSailing', diving: 'actDiving', snorkeling: 'actSnorkeling',
    fishing: 'actFishing', whale: 'actWhale', kayak: 'actKayak',
    beach: 'actBeach', culture: 'actCulture', ruins: 'actRuins',
    hiking: 'actHiking', cycling: 'actCycling', food: 'actFood',
    nightlife: 'actNightlife', baby: 'actBaby',
    // Régi értékek: már nem választhatók az appban, de meglévő sorokban
    // még szerepelhetnek. Megtartva, hogy azok se essenek vissza nyers kulcsra.
    party: 'actParty', surf: 'actSurf', wakeboard: 'actWakeboard',
  };
  const dictKey = map[key];
  return dictKey ? t(lang, dictKey) : key;
}

/** trips.trip_mode → lefordított címke. Ismeretlen mód → üres (a hívó elhagyja a sort). */
export function modeLabel(lang, mode) {
  const map = {
    skippered: 'modeSkippered',
    bareboat: 'modeBareboat',
    crew_finding: 'modeCrewFinding',
    charter_host: 'modeCharterHost',
  };
  const dictKey = map[mode];
  return dictKey ? t(lang, dictKey) : '';
}

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
 *
 * A számformátum SZÁNDÉKOSAN nyelvfüggetlen (ÉÉÉÉ. HH. NN.): a hónapnevek
 * lefordítása itt új hibalehetőség lenne (7 nyelv × 12 hónap), a számot
 * viszont mindenki érti, és a sorrend egyértelmű.
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

function shell({ lang, title, ogTitle, ogDesc, ogImage, ogUrl, noindex, inner }) {
  const l = lang || DEFAULT_LANG;
  return `<!DOCTYPE html>
<html lang="${esc(l)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(ogDesc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Aihoy!">
<meta property="og:locale" content="${esc(l)}">
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
  <a class="learn" href="/">${esc(t(l, 'learnMore'))}</a>
  <footer>
    <a href="/privacy.html">${esc(t(l, 'privacy'))}</a> ·
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
      // A válasz a látogató nyelvétől függ — a köztes cache-ek (és a
      // Cloudflare) ne szolgálják ki a magyar változatot egy görögnek.
      'vary': 'Accept-Language',
    },
  });
}

/**
 * Lejárt / nem létező / visszavont tartalom.
 * Szándékosan NEM mondjuk meg, melyik eset áll fenn — kívülről nézve mindegy,
 * és így nem lehet a linkek létezésére következtetni.
 * noindex: a keresők ne indexeljék a halott oldalakat.
 */
export function renderGone(kind, lang) {
  const l = lang || DEFAULT_LANG;
  const isTrip = kind === 'trip';
  return renderPage({
    lang: l,
    status: 404,
    noindex: true,
    title: t(l, 'gonePageTitle'),
    ogTitle: 'Aihoy!',
    ogDesc: t(l, 'brandTagline'),
    inner: `
      <div class="card">
        <div class="body gone">
          <div class="em">⚓</div>
          <h1>${esc(t(l, isTrip ? 'goneTitleTrip' : 'goneTitleWindow'))}</h1>
          <p>${esc(t(l, 'goneBody'))}</p>
          <a class="cta" href="${PLAY_URL}">${esc(t(l, 'goneCta'))}</a>
        </div>
      </div>`,
  });
}

export { PLAY_URL, FALLBACK_OG, SUPPORTED_LANGS, DEFAULT_LANG };
