// Impressum, Datenschutzerklärung and licence notes. Operator details come from /legal.json
// (on Railway generated from the LEGAL_* variables, see RECHTLICHES.md). No legal advice.
// The texts are translated; the German version is the binding one and can be shown on every page.
import { language, t as translate } from '../i18n/i18n.ts';
import { button, clear, h, modal } from './dom.ts';

export interface LegalInfo {
  configured: boolean;
  /** schule = public school (Art. 6 (1) e GDPR), privat / organisation = Art. 6 (1) f GDPR */
  type: 'schule' | 'privat' | 'organisation';
  name: string;
  representative: string;
  address: string;
  email: string;
  phone: string;
  /** the operator's own website, linked in the imprint */
  website: string;
  dpo: string;
  authority: string;
  supervision: string;
  contentResponsible: string;
  serverLocation: string;
  logDays: string;
  date: string;
}

const FALLBACK: LegalInfo = {
  configured: false,
  type: 'privat',
  name: '[Name der verantwortlichen Person oder Schule]',
  representative: '',
  address: '[Anschrift]',
  email: '[E-Mail-Adresse]',
  phone: '',
  website: '',
  dpo: '',
  authority: '',
  supervision: '',
  contentResponsible: '',
  serverLocation: 'EU West (Amsterdam, Niederlande)',
  logDays: '30',
  date: 'Oktober 2026',
};

let cached: Promise<LegalInfo> | null = null;

export function loadLegal(): Promise<LegalInfo> {
  if (!cached) {
    cached = fetch('/legal.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : FALLBACK))
      .then((j) => ({ ...FALLBACK, ...j }) as LegalInfo)
      .catch(() => FALLBACK);
  }
  return cached;
}

export function isLocalHost(): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

export type LegalPage = 'impressum' | 'datenschutz' | 'lizenzen';

export const LEGAL_PATHS: Record<string, LegalPage> = {
  '/impressum': 'impressum',
  '/datenschutz': 'datenschutz',
  '/lizenzen': 'lizenzen',
};

// ------------------------------------------------------------------ translation

/** while a page is built in its German original (the binding version), t() gives the German text */
let original = false;

function t(source: string, params?: Record<string, string | number>): string {
  if (!original) return translate(source, params);
  return params ? source.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : source;
}

/** builds a page in German (original) or in the page language */
function inGerman<T>(on: boolean, build: () => T): T {
  const was = original;
  original = on;
  try {
    return build();
  } finally {
    original = was;
  }
}

/** a translated text with links in it: "Mehr auf {link}." -> ["Mehr auf ", <a>, "."] */
function rich(text: string, parts: Record<string, Node | string>): (Node | string)[] {
  return text.split(/(\{\w+\})/).map((s) => {
    const k = /^\{(\w+)\}$/.exec(s)?.[1];
    return k && k in parts ? parts[k] : s;
  });
}

// ------------------------------------------------------------------ helpers

const lines = (text: string) => {
  const span = h('span');
  text.split('\n').forEach((l, i) => {
    if (i) span.append(h('br'));
    span.append(l);
  });
  return span;
};

const mail = (addr: string) => (addr.includes('@') ? h('a', { href: `mailto:${addr}` }, addr) : addr);

const ext = (href: string, text = href) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

/** "https://prelldynamics.de/" -> "prelldynamics.de" */
const bareUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

function section(title: string, ...body: (Node | string | null)[]): HTMLElement {
  return h('section', null, h('h3', null, title), ...body);
}

function p(...c: (Node | string | null)[]): HTMLElement {
  return h('p', null, ...c);
}

function list(items: (Node | string)[][]): HTMLElement {
  return h('ul', null, ...items.map((i) => h('li', null, ...i)));
}

function placeholderNote(info: LegalInfo): HTMLElement | null {
  if (info.configured) return null;
  return h(
    'div',
    { class: 'err-box' },
    h('b', null, t('Hinweis für den Betreiber:'), ' '),
    t('Die Angaben zum Verantwortlichen sind noch Platzhalter. Vor dem öffentlichen Betrieb bitte die LEGAL_*-Variablen setzen (siehe RECHTLICHES.md im Projekt).'),
  );
}

function operatorBlock(info: LegalInfo): HTMLElement {
  return p(
    h('b', null, info.name),
    info.representative ? h('br') : null,
    info.representative ? t('vertreten durch {name}', { name: info.representative }) : null,
    h('br'),
    lines(info.address),
    h('br'),
    t('E-Mail:'),
    ' ',
    mail(info.email),
    info.phone ? h('br') : null,
    info.phone ? t('Telefon: {phone}', { phone: info.phone }) : null,
    info.website ? h('br') : null,
    info.website ? t('Website:') + ' ' : null,
    info.website ? ext(info.website, bareUrl(info.website)) : null,
  );
}

function legalBasisHosting(info: LegalInfo): string {
  return info.type === 'schule'
    ? t('Art. 6 Abs. 1 UAbs. 1 lit. e DSGVO in Verbindung mit den Datenschutz- und Schulgesetzen des Landes (in Bayern z. B. Art. 4 Abs. 1 BayDSG): Die Bereitstellung des Lernangebots ist Teil der Aufgaben der Schule.')
    : t('Art. 6 Abs. 1 UAbs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt darin, die Website sicher und funktionsfähig auszuliefern und Missbrauch abzuwehren.');
}

// ------------------------------------------------------------------ pages

function impressum(info: LegalInfo): HTMLElement {
  return h(
    'div',
    { class: 'legal' },
    h('h2', null, t('Impressum')),
    placeholderNote(info),
    p(t('Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)')),
    operatorBlock(info),
    info.supervision ? section(t('Zuständige Aufsichtsbehörde'), p(lines(info.supervision))) : null,
    info.contentResponsible ? section(t('Inhaltlich verantwortlich'), p(lines(info.contentResponsible))) : null,
    section(
      t('Hinweis'),
      p(
        t('Krakel & Krone ist ein Lern- und Motivationsspiel für das Schreibenlernen. Die vergebenen Sterne und Stufen sind ein Spiel und keine Leistungsbewertung.'),
      ),
      info.website ? p(...rich(t('Mehr Projekte gibt es auf {link}.'), { link: ext(info.website, bareUrl(info.website)) })) : null,
    ),
    section(t('Verbraucherstreitbeilegung'), p(t('Der Anbieter ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'))),
    section(
      t('Haftung für Inhalte'),
      p(
        t('Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte – auch für die Bewertung der Handschrift durch die automatische Erkennung – wird keine Gewähr übernommen. Als Diensteanbieter ist der Anbieter für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich. Eine Verpflichtung, übermittelte oder gespeicherte fremde Informationen zu überwachen, besteht nicht. Sobald Rechtsverletzungen bekannt werden, werden die betreffenden Inhalte umgehend entfernt.'),
      ),
    ),
    section(
      t('Haftung für Links'),
      p(
        t('Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte der Anbieter keinen Einfluss hat. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft; rechtswidrige Inhalte waren nicht erkennbar. Werden Rechtsverletzungen bekannt, werden derartige Links umgehend entfernt.'),
      ),
    ),
    section(
      t('Urheberrecht'),
      p(
        t('Das Spiel – insbesondere Programm, Grafiken, Figuren und Texte – unterliegt dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der vorherigen schriftlichen Zustimmung des Anbieters. Die Kopiervorlage des Mal-Aquariums darf für den Unterricht und zu Hause ausgedruckt und kopiert werden. Inhalte Dritter (Schriftarten, Trainingsdaten der Handschrift-Erkennung) stehen unter ihren eigenen Lizenzen, siehe Lizenzhinweise.'),
      ),
    ),
    section(t('Datenschutz und Lizenzen'), p(t('Siehe Datenschutzerklärung und Lizenzhinweise (Links unten).'))),
  );
}

function datenschutz(info: LegalInfo): HTMLElement {
  // sections are numbered in order (the one about the data protection officer only exists when set)
  let num = 0;
  const n = () => ++num;
  return h(
    'div',
    { class: 'legal' },
    h('h2', null, t('Datenschutzerklärung')),
    p(h('span', { class: 'help' }, t('Stand: {date}', { date: info.date }))),
    placeholderNote(info),
    section(
      t('Das Wichtigste in Kürze'),
      list([
        rich(t('Die Kamerabilder werden {only} im Browser ausgewertet. Sie werden weder an uns noch an Dritte übertragen und nicht gespeichert.'), { only: h('b', null, t('ausschließlich auf Ihrem Gerät')) }),
        [t('Spielstände (ausgeschnittene Buchstaben, ausgemalte Bilder) werden nur in Ihrem Browser gespeichert und lassen sich jederzeit löschen.')],
        [t('Es gibt keine Benutzerkonten, keine Cookies, keine Werbung und keine Analysedienste Dritter. Deshalb gibt es auch kein Cookie-Banner.')],
        rich(t('Die App sendet eine {stats} (z. B. „Spiel gestartet“) ohne IP-Adresse, ohne Kennung und ohne Cookie. Sie lässt sich in den Einstellungen abschalten.'), { stats: h('b', null, t('anonyme Nutzungsstatistik')) }),
        [t('Nachrichten über das Kontaktformular speichern wir nur, um sie zu beantworten, und löschen sie spätestens nach 12 Monaten.')],
        [t('Die Kamera startet erst, wenn Sie sie einrichten oder ein Spiel beginnen.')],
        [t('Es werden keine externen Dienste eingebunden – auch Schriftarten und Programmteile kommen ausschließlich von unserem eigenen Server.')],
        [t('Beim Aufruf der Website verarbeitet unser Hosting-Anbieter technisch notwendige Verbindungsdaten (z. B. Ihre IP-Adresse).')],
      ]),
    ),
    section(t('{n}. Verantwortlicher', { n: n() }), operatorBlock(info)),
    info.dpo ? section(t('{n}. Datenschutzbeauftragte/r', { n: n() }), p(lines(info.dpo))) : null,
    section(
      t('{n}. Kamera und Handschrift', { n: n() }),
      p(
        t('Damit aus geschriebenen Buchstaben und Zahlen Spielfiguren werden, nimmt die App nach Ihrer Freigabe Bilder der Kamera (z. B. einer Dokumentenkamera) auf und wertet sie direkt im Browser aus (Erkennen der Zeichen, spielerische Bewertung, Ausschneiden der Zeichen für die Spielfiguren). Im „Mal-Aquarium“ erkennt die App ausgemalte Fisch-Karten und schneidet den Fisch (mit dem darauf geschriebenen Fischnamen) als Spielfigur aus.'),
      ),
      list([
        [t('Die Verarbeitung findet vollständig auf dem verwendeten Gerät statt. Wir als Anbieter erhalten keinen Zugriff auf Bilder oder Ergebnisse.')],
        [t('Die Kamerafotos liegen nur im Arbeitsspeicher und werden nach der Auswertung verworfen.')],
        [t('Ausgeschnittene Zeichen und ausgemalte Fisch-Karten gehören zum Spielstand: Sie werden in Ihrem Browser gespeichert, damit ein Spiel später weitergehen kann (siehe „Speicherung auf Ihrem Gerät“).')],
        [t('Es findet keine Gesichtserkennung und keine Identifizierung von Personen statt. Bitte richten Sie die Kamera so aus, dass nur das Papier zu sehen ist.')],
        [t('Die Bewertung ist ein Spiel zur Motivation. Es findet keine automatisierte Entscheidung im Sinne von Art. 22 DSGVO statt.')],
        [t('Auf Handy und Tablet startet die Kamera erst, wenn ein Foto gemacht wird (Sucher), und geht kurz danach wieder aus.')],
        [t('Den Kamerazugriff können Sie jederzeit in den Einstellungen Ihres Browsers widerrufen.')],
        [t('Auf der Labor-Seite geladene Fotos werden ebenfalls nur lokal verarbeitet; „Aufnahme speichern“ legt eine Datei nur auf Ihrem Gerät ab.')],
      ]),
    ),
    section(
      t('{n}. Speicherung auf Ihrem Gerät', { n: n() }),
      list([
        [
          h('b', null, t('Local Storage:'), ' '),
          t('Ihre Einstellungen (z. B. gewählte Kamera, Bildausschnitt, Strenge, Teamnamen und -farben, Übungsbuchstabe). Diese Daten verlassen Ihr Gerät nicht. Bitte tragen Sie als Teamnamen keine Namen von Kindern ein.'),
        ],
        [
          h('b', null, t('IndexedDB (Spielstände):'), ' '),
          t('das letzte Spiel jeder Spielart – nur wenn Sie das ausdrücklich wählen (die App fragt beim ersten Besuch bzw. beim ersten Verlassen eines Spiels, ob sie Spiele auf diesem Gerät merken soll) – und die Spiele, die Sie selbst unter einem Namen speichern. Ein Spielstand enthält die ausgeschnittenen Buchstaben bzw. ausgemalten Fische, ihre Bewertung, ein kleines Vorschaubild des Spiels und die Spieleinstellungen – keine Kamerafotos. Spielstände verlassen Ihr Gerät nicht. Laden Sie einen Spielstand als Datei herunter, liegt diese Datei nur bei Ihnen.'),
        ],
        [h('b', null, t('Service Worker / Cache:'), ' '), t('Programmdateien der App, damit sie auch ohne Internetverbindung funktioniert.')],
      ]),
      p(
        t('Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG: Die Speicherung ist unbedingt erforderlich, um die von Ihnen ausdrücklich gewünschten Funktionen bereitzustellen (Einstellungen behalten, ein Spiel fortsetzen). Sie können die Daten jederzeit löschen – einzelne Spielstände unter „📂 Spielstände“, alle über „Einstellungen → Alle Spielstände löschen“ bzw. „Alles zurücksetzen“, oder indem Sie die Websitedaten in Ihrem Browser löschen. Das automatische Merken lässt sich in den Einstellungen ausschalten.'),
      ),
    ),
    section(
      t('{n}. Kontaktformular', { n: n() }),
      p(
        t('Über „✉️ Kontakt & Feedback“ auf der Startseite können Sie uns eine Nachricht schicken. Gespeichert werden Ihre Nachricht, Datum und Uhrzeit, die Sprache der App sowie – nur wenn Sie sie angeben – Ihr Name und Ihre E-Mail-Adresse. Die IP-Adresse wird nicht gespeichert; sie wird nur kurz im Arbeitsspeicher genutzt, um massenhaftes Absenden (Spam) zu begrenzen.'),
      ),
      p(
        t('Zweck ist die Bearbeitung und Beantwortung Ihrer Anfrage. Rechtsgrundlage: Art. 6 Abs. 1 UAbs. 1 lit. f DSGVO (unser berechtigtes Interesse, Anfragen und Hinweise zur App zu beantworten) bzw. lit. b DSGVO, wenn Ihre Anfrage auf einen Vertrag zielt; bei öffentlichen Schulen lit. e DSGVO. Die Angaben sind freiwillig.'),
      ),
      p(
        t('Wir löschen die Nachricht, sobald sie erledigt ist, spätestens jedoch automatisch 12 Monate nach dem Eingang. Die Daten liegen in einer Datenbank beim Hosting-Anbieter (siehe „Hosting“) und werden nicht an Dritte weitergegeben. Bitte schreiben Sie keine Namen oder anderen Daten von Kindern in die Nachricht.'),
      ),
    ),
    section(
      t('{n}. Anonyme Nutzungsstatistik', { n: n() }),
      p(
        t('Damit wir sehen, welche Spiele genutzt werden, sendet die App kleine Meldungen an unseren Server: dass die App geöffnet wurde, dass eine Spielart gestartet oder beendet wurde, die Spieldauer, die Anzahl der erkannten Zeichen bzw. Karten pro Foto sowie die gewählte Schrift und Sprache. Gespeichert wird jede Meldung nur mit dem Kalendertag – ohne Uhrzeit, ohne IP-Adresse, ohne Geräte- oder Benutzerkennung und ohne Cookie. Einzelne Personen oder Geräte lassen sich daraus nicht erkennen; Bilder, Buchstaben und Spielstände werden nie übertragen.'),
      ),
      p(
        t('Die IP-Adresse wird beim Empfang nur kurz im Arbeitsspeicher verwendet, um Missbrauch zu begrenzen, und nicht gespeichert. Rechtsgrundlage für diese kurze Verarbeitung: Art. 6 Abs. 1 UAbs. 1 lit. f DSGVO (berechtigtes Interesse an einer sicheren, bedarfsgerecht weiterentwickelten App), bei öffentlichen Schulen lit. e DSGVO. Die Meldungen werden nach 13 Monaten automatisch gelöscht.'),
      ),
      p(
        h('b', null, t('Widerspruch:'), ' '),
        t('In den Einstellungen („⚙️ Einstellungen → Über → Anonyme Nutzungsstatistik senden“) können Sie die Statistik jederzeit abschalten. Diese Wahl wird nur im Local Storage Ihres Browsers gespeichert.'),
      ),
    ),
    section(
      t('{n}. Hosting und Server-Protokolle', { n: n() }),
      p(
        t('Die Website wird bei der Railway Corporation, 548 Market St PMB 68956, San Francisco, CA 94104, USA, betrieben. Railway verarbeitet die Daten als Auftragsverarbeiter auf Grundlage eines Vertrags zur Auftragsverarbeitung nach Art. 28 DSGVO.'),
        ' ',
        t('Standort des Servers: {location}.', { location: info.serverLocation }),
      ),
      p(
        t('Beim Aufruf der Website werden technisch notwendige Daten verarbeitet: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Statuscode, übertragene Datenmenge sowie Angaben zum Browser (User-Agent). Die App selbst schreibt keine Zugriffsprotokolle; die Datenbank für Kontaktformular und Nutzungsstatistik liegt ebenfalls bei Railway.'),
        ' ',
        t('Die Hosting-Plattform speichert Zugriffsprotokolle für höchstens {days} Tage und löscht sie danach automatisch.', { days: info.logDays }),
      ),
      p(t('Rechtsgrundlage: {basis}', { basis: legalBasisHosting(info) })),
      p(
        t('Railway ist ein Unternehmen mit Sitz in den USA; ein Zugriff aus den USA kann nicht ausgeschlossen werden. Die Übermittlung ist durch die EU-Standardvertragsklauseln (Durchführungsbeschluss (EU) 2021/914) im Auftragsverarbeitungsvertrag von Railway abgesichert bzw. – soweit Railway nach dem EU-U.S. Data Privacy Framework zertifiziert ist – durch den Angemessenheitsbeschluss der EU-Kommission vom 10. Juli 2023.'),
        ' ',
        ...rich(t('Weitere Informationen: {dpa}, {subprocessors}.'), {
          dpa: ext('https://railway.com/legal/dpa', t('Auftragsverarbeitungsvertrag von Railway')),
          subprocessors: ext('https://trust.railway.com/item/subprocessors', t('Unterauftragsverarbeiter')),
        }),
      ),
    ),
    section(
      t('{n}. Keine weiteren Empfänger', { n: n() }),
      p(t('Es werden keine Daten an weitere Empfänger übermittelt. Es gibt keine Einbindung von Social-Media-Diensten, Videoplattformen, Karten, Schriftarten- oder Skript-Servern Dritter.')),
    ),
    section(
      t('{n}. Ihre Rechte', { n: n() }),
      p(
        t('Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Widerspruch gegen die Verarbeitung (Art. 21 DSGVO). Wenden Sie sich dazu an den oben genannten Verantwortlichen.'),
      ),
      p(
        info.authority
          ? t('Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere bei der für uns zuständigen Behörde:')
          : t('Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).'),
      ),
      info.authority ? p(lines(info.authority)) : null,
    ),
    section(
      t('{n}. Kinder', { n: n() }),
      p(
        t('Die App ist für den Einsatz im Unterricht unter Aufsicht einer Lehrkraft gedacht. Es werden keine Daten der Kinder an uns oder Dritte übermittelt (die anonyme Nutzungsstatistik enthält keine Angaben zu Personen); die Kinder benötigen kein Konto.'),
      ),
    ),
  );
}

function lizenzen(): HTMLElement {
  const licenceText = (href: string) => ext(href, t('Lizenztext'));
  return h(
    'div',
    { class: 'legal' },
    h('h2', null, t('Lizenzen & Danksagung')),
    section(
      t('Schriftarten (SIL Open Font License 1.1)'),
      list([
        ['Fredoka – Copyright 2016 The Fredoka Project Authors. ', licenceText('/fonts/OFL-Fredoka.txt')],
        ['Playwrite DE Grund – Copyright 2023 The Playwrite Project Authors (TypeTogether). ', licenceText('/fonts/OFL-PlaywriteDEGrund.txt')],
        [
          t('„Druckvorlage“ – eine verkleinerte, umbenannte Fassung (Modified Version) der Schrift Andika, Copyright (c) 2004–2022 SIL International. Die reservierten Schriftnamen „Andika“ und „SIL“ werden für diese Fassung nicht verwendet.'),
          ' ',
          licenceText('/fonts/OFL-Druckvorlage-Andika.txt'),
        ],
        ['Playwrite DE SAS – Copyright 2023 The Playwrite Project Authors (TypeTogether). ', licenceText('/fonts/OFL-schreib-PlaywriteDESAS.txt')],
        ['Klee One – Copyright 2020 The Klee Project Authors. ', licenceText('/fonts/OFL-hiragana-KleeOne.txt')],
        [
          t('„{name}“ – eine verkleinerte, umbenannte Fassung (Modified Version) der Schrift {font}, {copyright}. Die reservierten Schriftnamen werden für diese Fassung nicht verwendet.', { name: 'Vorlage Kyrillisch', font: 'Andika', copyright: 'Copyright (c) 2004–2022 SIL International' }),
          ' ',
          licenceText('/fonts/OFL-kyrillisch-Andika.txt'),
        ],
        ['Noto Naskh Arabic – Copyright 2022 The Noto Project Authors. ', licenceText('/fonts/OFL-arabisch-NotoNaskhArabic.txt')],
        ['Baloo 2 – Copyright 2019 The Baloo 2 Project Authors. ', licenceText('/fonts/OFL-devanagari-Baloo2.txt')],
        ['Didact Gothic – Copyright (c) 2009, 2010, 2011 Daniel Johnson. ', licenceText('/fonts/OFL-griechisch-DidactGothic.txt')],
        [
          t('„{name}“ – eine verkleinerte, umbenannte Fassung (Modified Version) der Schrift {font}, {copyright}. Die reservierten Schriftnamen werden für diese Fassung nicht verwendet.', { name: 'Vorlage Hebraeisch', font: 'Varela Round', copyright: 'Copyright 2023 The Varela Round Project Authors' }),
          ' ',
          licenceText('/fonts/OFL-hebraeisch-VarelaRound.txt'),
        ],
        ['Gowun Dodum – Copyright 2021 The Gowun Dodum Project Authors. ', licenceText('/fonts/OFL-hangul-GowunDodum.txt')],
        ['Mali – Copyright 2018 The Mali Project Authors. ', licenceText('/fonts/OFL-thai-Mali.txt')],
      ]),
    ),
    section(
      t('Schreibreihenfolge der Hiragana und Katakana'),
      list([
        rich(
          t('KanjiVG – Copyright (C) Ulrich Apel und Mitwirkende, {site}. Lizenz: {licence}. Änderungen: Die Strichpfade wurden umgerechnet und für die Schreib-Animationen skaliert; diese Daten stehen unter derselben Lizenz.'),
          {
            site: ext('https://kanjivg.tagaini.net', 'kanjivg.tagaini.net'),
            licence: ext('https://creativecommons.org/licenses/by-sa/3.0/deed.de', 'CC BY-SA 3.0'),
          },
        ),
      ]),
    ),
    section(
      t('Handschrift-Erkennung'),
      p(
        ...rich(
          t('Das Erkennungsmodell wurde mit dem EMNIST-Datensatz trainiert: G. Cohen, S. Afshar, J. Tapson, A. van Schaik (2017): „EMNIST: an extension of MNIST to handwritten letters“, {paper}, Ursprungsdaten: NIST Special Database 19. Lizenz: {licence}. Änderungen: Aus den Daten wurde ein eigenes Erkennungsmodell trainiert (abgeleitetes Werk).'),
          {
            paper: ext('https://arxiv.org/abs/1702.05373', 'arXiv:1702.05373'),
            licence: ext('https://creativecommons.org/licenses/by/4.0/deed.de', 'CC BY 4.0'),
          },
        ),
      ),
      p(
        t('Zusätzliche Übungsbeispiele und die Vergleichsvorlagen wurden aus frei lizenzierten Schriften (SIL Open Font License bzw. Apache License 2.0) erzeugt, u. a. Andika, Playwrite DE Grund, Patrick Hand, Schoolbell, Comic Neue, Playpen Sans, Delius, Short Stack, Indie Flower, Gochi Hand, Kalam, Just Another Hand, Architects Daughter, Coming Soon, Sue Ellen Francisco, Handlee, Neucha, Mali, Itim und Sniglet.'),
      ),
      p(t('Jede andere Schrift hat ihr eigenes Erkennungsmodell. Diese Modelle wurden ebenso aus frei lizenzierten Schriften (SIL Open Font License bzw. Apache License 2.0) erzeugt, dazu aus zwei Handschrift-Datensätzen:')),
      list([
        rich(
          t('Kyrillisch: CoMNIST von Gregory Vial, {site}. Lizenz: {licence}. Änderungen: Aus den Daten wurde ein eigenes Erkennungsmodell trainiert; es steht unter derselben Lizenz.'),
          {
            site: ext('https://github.com/GregVial/CoMNIST', 'github.com/GregVial/CoMNIST'),
            licence: ext('https://creativecommons.org/licenses/by-sa/4.0/deed.de', 'CC BY-SA 4.0'),
          },
        ),
        rich(
          t('Devanagari: Devanagari Handwritten Character Dataset (S. Acharya, A. K. Pant, P. K. Gyawali), UCI Machine Learning Repository, {site}. Lizenz: {licence}. Änderungen: Aus den Daten wurde ein eigenes Erkennungsmodell trainiert (abgeleitetes Werk).'),
          {
            site: ext('https://archive.ics.uci.edu/dataset/389/devanagari+handwritten+character+dataset', 'archive.ics.uci.edu/dataset/389'),
            licence: ext('https://creativecommons.org/licenses/by/4.0/deed.de', 'CC BY 4.0'),
          },
        ),
      ]),
    ),
    section(
      t('Programm'),
      p(t('Im Browser verwendet die App eine einzige Bibliothek von Drittanbietern:')),
      list([
        [
          ext('https://github.com/kazuhikoarase/qrcode-generator', 'qrcode-generator'),
          ' – Copyright (c) 2009 Kazuhiko Arase. ',
          ...rich(t('Lizenz: {licence}. Sie erzeugt im Messemodus den QR-Code.'), { licence: ext('https://opensource.org/licenses/MIT', 'MIT') }),
          ' ',
          t('„QR Code“ ist eine eingetragene Marke der DENSO WAVE INCORPORATED.'),
        ],
      ]),
      p(t('Alle Grafiken und Töne werden im Browser erzeugt. Der Server nutzt für die Datenbank node-postgres (MIT-Lizenz).')),
    ),
  );
}

/** "Rechtlich verbindlich ist die deutsche Fassung." with a button to switch between the original and the translation */
function originalNote(german: boolean, toggle: () => void): HTMLElement {
  return h(
    'div',
    { class: 'help', style: 'border:2px solid currentColor;border-radius:12px;padding:6px 12px;margin-bottom:.6em;display:flex;gap:12px;align-items:center;flex-wrap:wrap' },
    h('span', null, t('Rechtlich verbindlich ist die deutsche Fassung.')),
    button(german ? t('Übersetzung anzeigen') : t('Deutsch anzeigen'), toggle, 'btn small'),
  );
}

export async function openLegal(page: LegalPage, onClose?: () => void): Promise<void> {
  const info = await loadLegal();
  // imprint and privacy policy are binding in German: a translated page can show the German original
  const binding = page !== 'lizenzen' && language() !== 'de';
  let german = false;
  const box = h('div');
  const render = () => {
    clear(box);
    const body = inGerman(german, () => (page === 'impressum' ? impressum(info) : page === 'datenschutz' ? datenschutz(info) : lizenzen()));
    if (german) {
      body.lang = 'de';
      body.dir = 'ltr';
    }
    box.append(...(binding ? [originalNote(german, () => {
      german = !german;
      render();
    })] : []), body);
  };
  render();
  const nav = h(
    'div',
    { class: 'actions', style: 'justify-content:space-between' },
    h(
      'div',
      { class: 'row', style: 'margin:0' },
      ...(['impressum', 'datenschutz', 'lizenzen'] as LegalPage[])
        .filter((x) => x !== page)
        .map((x) =>
          button(
            x === 'impressum' ? t('Impressum') : x === 'datenschutz' ? t('Datenschutz') : t('Lizenzen'),
            () => {
              m.close();
              void openLegal(x, onClose);
            },
            'btn small',
          ),
        ),
    ),
    button(t('Schließen'), () => m.close(), 'btn primary'),
  );
  const m = modal(h('div', { style: 'max-width:820px' }, box, nav), onClose);
}

/** Small row of links (start screen, lab). */
export function legalLinks(): HTMLElement {
  const link = (label: string, page: LegalPage) =>
    h(
      'a',
      {
        href: `/${page}`,
        onclick: (e: Event) => {
          e.preventDefault();
          void openLegal(page);
        },
      },
      label,
    );
  return h('nav', { class: 'legal-links', 'aria-label': t('Rechtliches') }, link(t('Impressum'), 'impressum'), ' · ', link(t('Datenschutz'), 'datenschutz'), ' · ', link(t('Lizenzen'), 'lizenzen'));
}

/** Warning for the operator when the app runs publicly without imprint/privacy details. */
export async function legalWarning(): Promise<HTMLElement | null> {
  if (isLocalHost()) return null;
  const info = await loadLegal();
  if (info.configured) return null;
  return h(
    'div',
    { class: 'legal-warning', role: 'status' },
    t('⚠️ Für den öffentlichen Betrieb fehlen noch Impressum und Datenschutz-Angaben des Betreibers (siehe RECHTLICHES.md).'),
  );
}
