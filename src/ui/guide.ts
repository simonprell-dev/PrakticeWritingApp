// "Für Lehrer und Eltern": what the game is about, how to use it in class and at home, saved games, keys
// and touch, and what happens with the camera pictures.
import { openLegal } from './legal.ts';
import { button, clear, h, modal, segmented } from './dom.ts';
import { t } from '../i18n/i18n.ts';

type Tab = 'lehrer' | 'eltern' | 'tasten' | 'daten';

const list = (...items: (string | Node)[]) => h('ul', null, ...items.map((i) => h('li', null, i)));
const b = (text: string) => h('b', null, text);
const p = (...parts: (string | Node)[]) => h('p', null, ...parts);
/** a translated text with bold parts: its {name} placeholders are replaced by the given nodes */
const rich = (text: string, parts: Record<string, Node>) =>
  h('span', null, ...text.split(/(\{\w+\})/).filter(Boolean).map((s) => parts[s.slice(1, -1)] ?? s));

function teachers(): HTMLElement {
  return h(
    'div',
    null,
    h('h3', null, t('Was Sie brauchen')),
    list(
      t('Laptop mit Chrome oder Edge, Beamer oder großer Bildschirm – oder für kleine Gruppen einfach ein Tablet'),
      t('Dokumentenkamera (eine Webcam geht auch) – Licht der Kamera einschalten'),
      t('Filzstift oder weicher Bleistift (B/2B)'),
      t('Papier: Heftseiten mit Lineatur 1, 2 oder 3, normal liniert, kariert oder blanko'),
    ),
    h('h3', null, t('Mit Handy oder Tablet')),
    list(
      t('Die App läuft direkt auf dem Gerät. „📷 Fertig!“ öffnet die Kamera: Gerät übers Blatt halten, bis alles im Rahmen ist, und auf den runden Knopf tippen.'),
      t('Die Kamera ist nur an, solange der Sucher offen ist. Quer gehalten ist das Spiel am größten.'),
      t('Umschalten zwischen fester Kamera und Handy/Tablet: „Kamera einrichten“ oder „So spielt ihr“ auf der Startseite.'),
    ),
    h('h3', null, t('Einmal einrichten')),
    list(
      h('span', null, b(t('Kamera einrichten: ')), t('Gerät wählen, drehen bis die Schrift aufrecht steht, einen Rahmen um den Schreibbereich ziehen, Testscan.')),
      h('span', null, b(t('Einstellungen: ')), t('Lineatur (automatisch oder fest Lineatur 1, 2 oder 3), Vorlage in Grundschrift oder Druckschrift, Strenge der Bewertung.')),
    ),
    h('h3', null, t('So läuft eine Runde')),
    list(
      t('Die Kinder schreiben unter der Kamera.'),
      rich(t('{enter} oder der Knopf {done} machen sofort ein Foto. Leertaste und Presenter warten kurz, bis die Hände aus dem Bild sind. Es geht auch automatisch (👁).'), { enter: b('Enter'), done: b(t('„Fertig!“')) }),
      t('Auf demselben Blatt kann weitergeschrieben werden: ausgewertet wird nur das Neue. Für ein frisches Blatt „Neues Blatt“ drücken (Taste N).'),
      t('Jedes Zeichen wird zu einem Wesen. Antippen zeigt das Zeichen groß mit einem Tipp.'),
    ),
    h('h3', null, t('Die Spielarten')),
    list(
      h('span', null, b(t('Meer, Weltraum, Savanne: ')), t('frei schreiben oder Buchstaben üben.')),
      h(
        'span',
        null,
        b(t('Buchstaben üben: ')),
        t('mehrere Buchstaben auswählen – sie kommen nacheinander dran (je 3, 5 oder 10×). Eine Vorlage zeigt, wie der Buchstabe geschrieben wird: mit Startpunkten, Pfeilen und Strichreihenfolge. Antippen zeigt die Vorführung groß. Ab und zu schwebt ein Überraschungs-Buchstabe in einer Blase herein.'),
      ),
      h('span', null, b(t('Team-Duell: ')), t('zwei Teams, die Buchstaben kämpfen um Seifenblasen-Burgen.')),
      h('span', null, b(t('Türme bauen: ')), t('zwei bis acht Teams bauen um die Wette – schöne Buchstaben sind hohe Bausteine.')),
      h('span', null, b(t('Klasse gegen Riesenburg: ')), t('die ganze Klasse gemeinsam gegen Riese Rumpel.')),
      h(
        'span',
        null,
        b(t('Mal-Aquarium: ')),
        t('hier wird gemalt statt geschrieben. Die Kopiervorlage (sechs Tiere pro A4-Blatt) drucken Sie in der Spielvorbereitung aus – zur Wahl stehen zwölf Meerestiere, zwei gemischte Blätter und eine Karte „Eigenes Tier“ zum freien Zeichnen. Jedes Kind malt sein Tier an und kann ihm unten einen Namen geben. Unter der Kamera schwimmt das Tier dann mit genau diesen Farben los – ausgeschnitten oder als ganzes Blatt, Hauptsache der schwarze Rahmen ist ganz zu sehen. Noch weiße und schon bekannte Karten zählen nicht doppelt.'),
      ),
    ),
    h('h3', null, t('Weiterspielen, speichern, laden')),
    list(
      t('Wenn Sie es erlauben (die App fragt einmal), merkt sie sich das letzte Spiel jeder Spielart. Wählen Sie die Spielart wieder, fragt sie: weiterspielen oder neu beginnen? Auf der Startseite steht außerdem „▶ Weiterspielen“ für das zuletzt gespielte Spiel.'),
      t('Auch nach einem Neuladen der Seite oder am nächsten Tag geht es weiter – auf demselben Blatt zählt nur das Neue.'),
      rich(t('{save} (oder Taste S) speichert das Spiel unter einem Namen, z. B. pro Klasse. Unter {games} auf der Startseite laden, herunterladen oder löschen Sie es.'), { save: b(t('💾 im Spiel')), games: b(t('„📂 Spielstände“')) }),
      t('Als Datei heruntergeladen lässt sich ein Spiel auf einen anderen Computer mitnehmen („Datei öffnen …“).'),
      t('Gespeichert wird nur in diesem Browser. Auf gemeinsam genutzten Geräten lässt sich das automatische Merken in den Einstellungen ausschalten.'),
    ),
    h('h3', null, t('Teams erkennen')),
    list(
      t('An der Stiftfarbe oder an der Zettelfarbe. In der Spielvorbereitung „Farbe im Foto zeigen“ antippen: die Kamera macht ein Foto, Sie tippen auf einen Strich bzw. Zettel des Teams. Ist eine Farbe der eines anderen Teams zu ähnlich, wird gewarnt.'),
      t('Oder ganz ohne Farben: Taste 1 bis 8 (oder die Team-Knöpfe neben „Fertig!“) – das nächste Foto zählt komplett für dieses Team. Bei vielen Teams ist das der sicherste Weg.'),
    ),
    h('h3', null, t('Wie bewertet wird')),
    p(
      t('Das Spiel schaut, wie gut ein Zeichen lesbar ist, wie nah es an der Vorlage liegt, wie ruhig der Strich ist und wie groß und gerade es steht. Auf Lineatur zählt auch, ob der Buchstabe in die richtigen Bänder passt: kleine Buchstaben ins Mittelband, große bis zur Oberlinie, g, p, q und y bis zur Unterlinie. Die Strenge lässt sich einstellen.'),
    ),
    p(
      b(t('Spiegelschrift: ')),
      t('Spiegelverkehrte Buchstaben (z. B. ein umgedrehtes S, Z, N oder eine umgedrehte 3) erkennt das Spiel. Normalerweise zählen sie mit weniger Sternen und dem Tipp „Dreh mich um“. Mit dem Kippschalter „Spiegelschrift zählt nicht“ in den Einstellungen zählen sie gar nicht: Es schlüpft kein Wesen und es gibt keinen Baustein. b/d und p/q sind gespiegelt echte Buchstaben und lassen sich nicht unterscheiden.'),
    ),
    p(
      b(t('Wichtig: ')),
      t('Die Bewertung ist eine spielerische Rückmeldung, keine Note. Die Erkennung kann sich irren – besonders bei sehr kleiner Schrift, Schatten oder Buchstaben, die sich berühren.'),
    ),
    h('h3', null, t('Tipps für die Klasse')),
    list(t('Etwas Platz zwischen den Buchstaben lassen.'), t('Zettel im Duell auf eine dunkle Unterlage legen.'), t('Kinder wechseln sich unter der Kamera ab – die anderen feuern an.')),
  );
}

function parents(): HTMLElement {
  return h(
    'div',
    null,
    p(t('Zu Hause geht es am einfachsten mit einem Handy oder Tablet: Ihr Kind schreibt oder malt, tippt auf „📷 Fertig!“, hält das Gerät übers Blatt und drückt auf den runden Knopf. Das Wesen erscheint dann direkt auf dem Gerät.')),
    p(t('Es geht auch mit einem Laptop und seiner Webcam: so hinstellen, dass die Kamera auf das Blatt schaut – zum Beispiel aufgeklappt hinter einem Bücherstapel – und unter „Kamera einrichten“ den Ausschnitt einstellen.')),
    h('h3', null, t('So macht es Spaß')),
    list(
      t('Lieber kurz und oft: zehn Minuten reichen.'),
      t('Die Buchstaben üben, die gerade in der Schule dran sind. Bei „Buchstaben üben“ können Sie mehrere auswählen; sie kommen nacheinander.'),
      t('Die Vorlage zeigt, wo man anfängt und in welche Richtung der Stift läuft – so wie in der Schule. Schulen und Schreiblehrgänge unterscheiden sich manchmal leicht; im Zweifel gilt, was die Lehrkraft zeigt.'),
      t('Wenn das Kind ein Heft mit Lineatur hat: genau darauf schreiben lassen. Die App achtet dann auch darauf, ob die Buchstaben in die Linien passen.'),
    ),
    h('h3', null, t('Loben Sie die Mühe')),
    p(
      t('Zerknitterte, schiefe Wesen sind lustig, nicht schlecht. Freuen Sie sich mit Ihrem Kind über jede Krone – und über jedes Wesen, das „nur“ freundlich ist. Die Tipps der Wesen („Bäuche schön zumachen!“, „Genau bis an die Linien schreiben!“) sind kleine Hinweise, keine Kritik.'),
    ),
    p(t('Die Bewertung ist eine spielerische Rückmeldung und kann sich auch einmal irren.')),
  );
}

function keys(): HTMLElement {
  const row = (k: string, what: string) => h('tr', null, h('td', null, b(k)), h('td', null, what));
  return h(
    'div',
    null,
    h(
      'table',
      { class: 'keys' },
      row(t('Enter / „Fertig!“'), t('Foto sofort')),
      row(t('Leertaste, Bild↓, Pfeil → (Presenter)'), t('Foto, sobald die Hände aus dem Bild sind')),
      row(t('1 bis 8 / Team-Knöpfe'), t('Foto sofort – alle Zeichen gehören zu diesem Team (Duell: 1, 2; Türme: bis 8)')),
      row('N', t('Neues Blatt (alles gilt wieder als neu)')),
      row('A', t('Automatisch scannen an/aus')),
      row('F', t('Vollbild')),
      row('S', t('Spiel speichern (unter einem Namen oder als Datei)')),
      row('Esc', t('Pause und Menü')),
    ),
    h('h3', null, t('Mit Touch (Tablet, Touch-Bildschirm, Whiteboard)')),
    list(
      t('Alles hat auch einen Knopf: „Fertig!“, Team-Knöpfe, Neues Blatt, Automatik (👁), Speichern (💾), Vollbild (⛶), Menü (⌂).'),
      t('Auf Handy und Tablet öffnet „📷 Fertig!“ den Kamera-Sucher; der runde Knopf macht das Foto, ✕ bricht ab.'),
      t('Ein Wesen antippen zeigt das Zeichen groß mit Tipp – im Mal-Aquarium das Tier mit seinem Namen.'),
      t('Die kleine Schreib-Vorlage oben antippen zeigt die große Vorführung.'),
      t('Teamfarben werden im Foto angetippt.'),
    ),
  );
}

function privacy(close: () => void): HTMLElement {
  return h(
    'div',
    null,
    list(
      t('Die Kamerabilder werden nur auf diesem Gerät ausgewertet – nichts wird verschickt. Die Fotos selbst werden nicht gespeichert.'),
      t('Keine Konten, keine Cookies, kein Tracking, keine Werbung.'),
      t('Gespeichert werden in diesem Browser die Einstellungen (z. B. Teamnamen, Übungsbuchstaben) und die Spielstände: die ausgeschnittenen Buchstaben und die ausgemalten Tiere (mit dem Tiernamen, falls einer daraufsteht). Löschen: „📂 Spielstände“ oder Einstellungen → „Alle Spielstände löschen“.'),
      t('Bitte die Kamera nur auf das Papier richten und als Teamnamen keine Namen von Kindern verwenden. Auf die Tier-Karten gehört ein Tiername, nicht der Name des Kindes.'),
    ),
    h(
      'div',
      { class: 'actions' },
      button(t('Datenschutzerklärung lesen'), () => {
        close();
        void openLegal('datenschutz');
      }, 'btn small'),
    ),
  );
}

export function openGuide(): void {
  const body = h('div', { class: 'guide' });
  const show = (tab: Tab) => {
    clear(body);
    body.append(tab === 'lehrer' ? teachers() : tab === 'eltern' ? parents() : tab === 'tasten' ? keys() : privacy(() => m.close()));
  };
  const content = h(
    'div',
    { style: 'max-width:820px' },
    h('h2', null, t('👩‍🏫 Für Lehrer und Eltern')),
    p(
      t('Krakel & Krone macht Schreibübungen zum Spiel: Die Kinder schreiben mit Stift auf Papier, eine Kamera fotografiert das Blatt, und aus jedem Buchstaben wird ein kleines Wesen. Je sorgfältiger geschrieben, desto prächtiger das Wesen – Krakel werden zu lustigen, zerknitterten Wesen. Jedes Zeichen bekommt ein Wesen und einen freundlichen Tipp. Im Mal-Aquarium wird gemalt statt geschrieben: Ausgemalte Meerestiere schwimmen in ihren eigenen Farben.'),
    ),
    segmented(
      [
        { value: 'lehrer', label: t('Lehrkräfte') },
        { value: 'eltern', label: t('Eltern') },
        { value: 'tasten', label: t('Tasten & Touch') },
        { value: 'daten', label: t('Datenschutz') },
      ],
      'lehrer' as Tab,
      show,
    ),
    body,
    h('div', { class: 'actions' }, button(t('Alles klar!'), () => m.close(), 'btn primary')),
  );
  show('lehrer');
  const m = modal(content);
}
