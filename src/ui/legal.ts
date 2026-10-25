// Impressum, Datenschutzerklärung and licence notes. Operator details come from /legal.json
// (on Railway generated from the LEGAL_* variables, see RECHTLICHES.md). No legal advice.
import { button, h, modal } from './dom.ts';

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
    h('b', null, 'Hinweis für den Betreiber: '),
    'Die Angaben zum Verantwortlichen sind noch Platzhalter. Vor dem öffentlichen Betrieb bitte die LEGAL_*-Variablen setzen (siehe RECHTLICHES.md im Projekt).',
  );
}

function operatorBlock(info: LegalInfo): HTMLElement {
  return p(
    h('b', null, info.name),
    info.representative ? h('br') : null,
    info.representative ? `vertreten durch ${info.representative}` : null,
    h('br'),
    lines(info.address),
    h('br'),
    'E-Mail: ',
    mail(info.email),
    info.phone ? h('br') : null,
    info.phone ? `Telefon: ${info.phone}` : null,
    info.website ? h('br') : null,
    info.website ? 'Website: ' : null,
    info.website ? ext(info.website, bareUrl(info.website)) : null,
  );
}

function legalBasisHosting(info: LegalInfo): string {
  return info.type === 'schule'
    ? 'Art. 6 Abs. 1 UAbs. 1 lit. e DSGVO in Verbindung mit den Datenschutz- und Schulgesetzen des Landes (in Bayern z. B. Art. 4 Abs. 1 BayDSG): Die Bereitstellung des Lernangebots ist Teil der Aufgaben der Schule.'
    : 'Art. 6 Abs. 1 UAbs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt darin, die Website sicher und funktionsfähig auszuliefern und Missbrauch abzuwehren.';
}

// ------------------------------------------------------------------ pages

function impressum(info: LegalInfo): HTMLElement {
  return h(
    'div',
    { class: 'legal' },
    h('h2', null, 'Impressum'),
    placeholderNote(info),
    p('Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)'),
    operatorBlock(info),
    info.supervision ? section('Zuständige Aufsichtsbehörde', p(lines(info.supervision))) : null,
    info.contentResponsible ? section('Inhaltlich verantwortlich', p(lines(info.contentResponsible))) : null,
    section(
      'Hinweis',
      p(
        'Krakel & Krone ist ein Lern- und Motivationsspiel für das Schreibenlernen. Die vergebenen Sterne und Stufen sind ein Spiel und keine Leistungsbewertung.',
      ),
      info.website ? p('Mehr Projekte gibt es auf ', ext(info.website, bareUrl(info.website)), '.') : null,
    ),
    section('Verbraucherstreitbeilegung', p('Der Anbieter ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.')),
    section(
      'Haftung für Inhalte',
      p(
        'Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte – auch für die Bewertung der Handschrift durch die automatische Erkennung – wird keine Gewähr übernommen. Als Diensteanbieter ist der Anbieter für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich. Eine Verpflichtung, übermittelte oder gespeicherte fremde Informationen zu überwachen, besteht nicht. Sobald Rechtsverletzungen bekannt werden, werden die betreffenden Inhalte umgehend entfernt.',
      ),
    ),
    section(
      'Haftung für Links',
      p(
        'Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte der Anbieter keinen Einfluss hat. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft; rechtswidrige Inhalte waren nicht erkennbar. Werden Rechtsverletzungen bekannt, werden derartige Links umgehend entfernt.',
      ),
    ),
    section(
      'Urheberrecht',
      p(
        'Das Spiel – insbesondere Programm, Grafiken, Figuren und Texte – unterliegt dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der vorherigen schriftlichen Zustimmung des Anbieters. Die Kopiervorlage des Mal-Aquariums darf für den Unterricht und zu Hause ausgedruckt und kopiert werden. Inhalte Dritter (Schriftarten, Trainingsdaten der Handschrift-Erkennung) stehen unter ihren eigenen Lizenzen, siehe Lizenzhinweise.',
      ),
    ),
    section('Datenschutz und Lizenzen', p('Siehe Datenschutzerklärung und Lizenzhinweise (Links unten).')),
  );
}

function datenschutz(info: LegalInfo): HTMLElement {
  return h(
    'div',
    { class: 'legal' },
    h('h2', null, 'Datenschutzerklärung'),
    p(h('span', { class: 'help' }, `Stand: ${info.date}`)),
    placeholderNote(info),
    section(
      'Das Wichtigste in Kürze',
      list([
        ['Die Kamerabilder werden ', h('b', null, 'ausschließlich auf Ihrem Gerät'), ' im Browser ausgewertet. Sie werden weder an uns noch an Dritte übertragen und nicht gespeichert.'],
        ['Spielstände (ausgeschnittene Buchstaben, ausgemalte Bilder) werden nur in Ihrem Browser gespeichert und lassen sich jederzeit löschen.'],
        ['Es gibt keine Benutzerkonten, keine Cookies, kein Tracking, keine Werbung und keine Analysedienste.'],
        ['Es werden keine externen Dienste eingebunden – auch Schriftarten und Programmteile kommen ausschließlich von unserem eigenen Server.'],
        ['Beim Aufruf der Website verarbeitet unser Hosting-Anbieter technisch notwendige Verbindungsdaten (z. B. Ihre IP-Adresse).'],
      ]),
    ),
    section('1. Verantwortlicher', operatorBlock(info)),
    info.dpo ? section('2. Datenschutzbeauftragte/r', p(lines(info.dpo))) : null,
    section(
      `${info.dpo ? '3' : '2'}. Kamera und Handschrift`,
      p(
        'Damit aus geschriebenen Buchstaben und Zahlen Spielfiguren werden, nimmt die App nach Ihrer Freigabe Bilder der Kamera (z. B. einer Dokumentenkamera) auf und wertet sie direkt im Browser aus (Erkennen der Zeichen, spielerische Bewertung, Ausschneiden der Zeichen für die Spielfiguren). Im „Mal-Aquarium“ erkennt die App ausgemalte Fisch-Karten und schneidet den Fisch (mit dem darauf geschriebenen Fischnamen) als Spielfigur aus.',
      ),
      list([
        ['Die Verarbeitung findet vollständig auf dem verwendeten Gerät statt. Wir als Anbieter erhalten keinen Zugriff auf Bilder oder Ergebnisse.'],
        ['Die Kamerafotos liegen nur im Arbeitsspeicher und werden nach der Auswertung verworfen.'],
        ['Ausgeschnittene Zeichen und ausgemalte Fisch-Karten gehören zum Spielstand: Sie werden in Ihrem Browser gespeichert, damit ein Spiel später weitergehen kann (siehe „Speicherung auf Ihrem Gerät“).'],
        ['Es findet keine Gesichtserkennung und keine Identifizierung von Personen statt. Bitte richten Sie die Kamera so aus, dass nur das Papier zu sehen ist.'],
        ['Die Bewertung ist ein Spiel zur Motivation. Es findet keine automatisierte Entscheidung im Sinne von Art. 22 DSGVO statt.'],
        ['Auf Handy und Tablet startet die Kamera erst, wenn ein Foto gemacht wird (Sucher), und geht kurz danach wieder aus.'],
        ['Den Kamerazugriff können Sie jederzeit in den Einstellungen Ihres Browsers widerrufen.'],
        ['Auf der Labor-Seite geladene Fotos werden ebenfalls nur lokal verarbeitet; „Aufnahme speichern“ legt eine Datei nur auf Ihrem Gerät ab.'],
      ]),
    ),
    section(
      `${info.dpo ? '4' : '3'}. Speicherung auf Ihrem Gerät`,
      list([
        [
          h('b', null, 'Local Storage: '),
          'Ihre Einstellungen (z. B. gewählte Kamera, Bildausschnitt, Strenge, Teamnamen und -farben, Übungsbuchstabe). Diese Daten verlassen Ihr Gerät nicht. Bitte tragen Sie als Teamnamen keine Namen von Kindern ein.',
        ],
        [
          h('b', null, 'IndexedDB (Spielstände): '),
          'das letzte Spiel jeder Spielart (nur solange „Letztes Spiel merken“ eingeschaltet ist) und die Spiele, die Sie unter einem Namen speichern. Ein Spielstand enthält die ausgeschnittenen Buchstaben bzw. ausgemalten Fische, ihre Bewertung, ein kleines Vorschaubild des Spiels und die Spieleinstellungen – keine Kamerafotos. Spielstände verlassen Ihr Gerät nicht. Laden Sie einen Spielstand als Datei herunter, liegt diese Datei nur bei Ihnen.',
        ],
        [h('b', null, 'Service Worker / Cache: '), 'Programmdateien der App, damit sie auch ohne Internetverbindung funktioniert.'],
      ]),
      p(
        'Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG: Die Speicherung ist unbedingt erforderlich, um die von Ihnen ausdrücklich gewünschten Funktionen bereitzustellen (Einstellungen behalten, ein Spiel fortsetzen). Sie können die Daten jederzeit löschen – einzelne Spielstände unter „📂 Spielstände“, alle über „Einstellungen → Alle Spielstände löschen“ bzw. „Alles zurücksetzen“, oder indem Sie die Websitedaten in Ihrem Browser löschen. Das automatische Merken lässt sich in den Einstellungen ausschalten.',
      ),
    ),
    section(
      `${info.dpo ? '5' : '4'}. Hosting und Server-Protokolle`,
      p(
        'Die Website wird bei der Railway Corporation, 548 Market St PMB 68956, San Francisco, CA 94104, USA, betrieben. Railway verarbeitet die Daten als Auftragsverarbeiter auf Grundlage eines Vertrags zur Auftragsverarbeitung nach Art. 28 DSGVO. ',
        `Standort des Servers: ${info.serverLocation}.`,
      ),
      p(
        'Beim Aufruf der Website werden technisch notwendige Daten verarbeitet: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Statuscode, übertragene Datenmenge sowie Angaben zum Browser (User-Agent). Die App selbst schreibt keine Zugriffsprotokolle; die Hosting-Plattform speichert Zugriffsprotokolle ',
        `für höchstens ${info.logDays} Tage und löscht sie danach automatisch.`,
      ),
      p(`Rechtsgrundlage: ${legalBasisHosting(info)}`),
      p(
        'Railway ist ein Unternehmen mit Sitz in den USA; ein Zugriff aus den USA kann nicht ausgeschlossen werden. Die Übermittlung ist durch die EU-Standardvertragsklauseln (Durchführungsbeschluss (EU) 2021/914) im Auftragsverarbeitungsvertrag von Railway abgesichert bzw. – soweit Railway nach dem EU-U.S. Data Privacy Framework zertifiziert ist – durch den Angemessenheitsbeschluss der EU-Kommission vom 10. Juli 2023. Weitere Informationen: ',
        ext('https://railway.com/legal/dpa', 'Auftragsverarbeitungsvertrag von Railway'),
        ', ',
        ext('https://trust.railway.com/item/subprocessors', 'Unterauftragsverarbeiter'),
        '.',
      ),
    ),
    section(
      `${info.dpo ? '6' : '5'}. Keine weiteren Empfänger`,
      p('Es werden keine Daten an weitere Empfänger übermittelt. Es gibt keine Einbindung von Social-Media-Diensten, Videoplattformen, Karten, Schriftarten- oder Skript-Servern Dritter.'),
    ),
    section(
      `${info.dpo ? '7' : '6'}. Ihre Rechte`,
      p(
        'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Widerspruch gegen die Verarbeitung (Art. 21 DSGVO). Wenden Sie sich dazu an den oben genannten Verantwortlichen.',
      ),
      p(
        'Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO)',
        info.authority ? ', insbesondere bei der für uns zuständigen Behörde:' : '.',
      ),
      info.authority ? p(lines(info.authority)) : null,
    ),
    section(
      `${info.dpo ? '8' : '7'}. Kinder`,
      p(
        'Die App ist für den Einsatz im Unterricht unter Aufsicht einer Lehrkraft gedacht. Es werden keine Daten der Kinder an uns oder Dritte übermittelt; die Kinder benötigen kein Konto.',
      ),
    ),
  );
}

function lizenzen(): HTMLElement {
  return h(
    'div',
    { class: 'legal' },
    h('h2', null, 'Lizenzen & Danksagung'),
    section(
      'Schriftarten (SIL Open Font License 1.1)',
      list([
        ['Fredoka – Copyright 2016 The Fredoka Project Authors. ', ext('/fonts/OFL-Fredoka.txt', 'Lizenztext')],
        ['Playwrite DE Grund – Copyright 2023 The Playwrite Project Authors (TypeTogether). ', ext('/fonts/OFL-PlaywriteDEGrund.txt', 'Lizenztext')],
        [
          '„Druckvorlage“ – eine verkleinerte, umbenannte Fassung (Modified Version) der Schrift Andika, Copyright (c) 2004–2022 SIL International. Die reservierten Schriftnamen „Andika“ und „SIL“ werden für diese Fassung nicht verwendet. ',
          ext('/fonts/OFL-Druckvorlage-Andika.txt', 'Lizenztext'),
        ],
      ]),
    ),
    section(
      'Handschrift-Erkennung',
      p(
        'Das Erkennungsmodell wurde mit dem EMNIST-Datensatz trainiert: G. Cohen, S. Afshar, J. Tapson, A. van Schaik (2017): „EMNIST: an extension of MNIST to handwritten letters“, ',
        ext('https://arxiv.org/abs/1702.05373', 'arXiv:1702.05373'),
        ', Ursprungsdaten: NIST Special Database 19. Lizenz: ',
        ext('https://creativecommons.org/licenses/by/4.0/deed.de', 'CC BY 4.0'),
        '. Änderungen: Aus den Daten wurde ein eigenes Erkennungsmodell trainiert (abgeleitetes Werk).',
      ),
      p(
        'Zusätzliche Übungsbeispiele und die Vergleichsvorlagen wurden aus frei lizenzierten Schriften (SIL Open Font License bzw. Apache License 2.0) erzeugt, u. a. Andika, Playwrite DE Grund, Patrick Hand, Schoolbell, Comic Neue, Playpen Sans, Delius, Short Stack, Indie Flower, Gochi Hand, Kalam, Just Another Hand, Architects Daughter, Coming Soon, Sue Ellen Francisco, Handlee, Neucha, Mali, Itim und Sniglet.',
      ),
    ),
    section('Programm', p('Die App verwendet zur Laufzeit keine Bibliotheken von Drittanbietern. Alle Grafiken und Töne werden im Browser erzeugt.')),
  );
}

export async function openLegal(page: LegalPage, onClose?: () => void): Promise<void> {
  const info = await loadLegal();
  const body = page === 'impressum' ? impressum(info) : page === 'datenschutz' ? datenschutz(info) : lizenzen();
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
            x === 'impressum' ? 'Impressum' : x === 'datenschutz' ? 'Datenschutz' : 'Lizenzen',
            () => {
              m.close();
              void openLegal(x, onClose);
            },
            'btn small',
          ),
        ),
    ),
    button('Schließen', () => m.close(), 'btn primary'),
  );
  const m = modal(h('div', { style: 'max-width:820px' }, body, nav), onClose);
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
  return h('nav', { class: 'legal-links', 'aria-label': 'Rechtliches' }, link('Impressum', 'impressum'), ' · ', link('Datenschutz', 'datenschutz'), ' · ', link('Lizenzen', 'lizenzen'));
}

/** Warning for the operator when the app runs publicly without imprint/privacy details. */
export async function legalWarning(): Promise<HTMLElement | null> {
  if (isLocalHost()) return null;
  const info = await loadLegal();
  if (info.configured) return null;
  return h(
    'div',
    { class: 'legal-warning', role: 'status' },
    '⚠️ Für den öffentlichen Betrieb fehlen noch Impressum und Datenschutz-Angaben des Betreibers (siehe RECHTLICHES.md).',
  );
}
