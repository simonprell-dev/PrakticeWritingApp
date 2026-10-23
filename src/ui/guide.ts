// "Für Lehrer und Eltern": what the game is about, how to use it in class and at home, saved games, keys
// and touch, and what happens with the camera pictures.
import { openLegal } from './legal.ts';
import { button, clear, h, modal, segmented } from './dom.ts';

type Tab = 'lehrer' | 'eltern' | 'tasten' | 'daten';

const list = (...items: (string | Node)[]) => h('ul', null, ...items.map((i) => h('li', null, i)));
const b = (text: string) => h('b', null, text);
const p = (...parts: (string | Node)[]) => h('p', null, ...parts);

function teachers(): HTMLElement {
  return h(
    'div',
    null,
    h('h3', null, 'Was Sie brauchen'),
    list(
      'Laptop mit Chrome oder Edge, Beamer oder großer Bildschirm',
      'Dokumentenkamera (eine Webcam geht auch) – Licht der Kamera einschalten',
      'Filzstift oder weicher Bleistift (B/2B)',
      'Papier: Heftseiten mit Lineatur 1, 2 oder 3, normal liniert, kariert oder blanko',
    ),
    h('h3', null, 'Einmal einrichten'),
    list(
      h('span', null, b('Kamera einrichten: '), 'Gerät wählen, drehen bis die Schrift aufrecht steht, einen Rahmen um den Schreibbereich ziehen, Testscan.'),
      h('span', null, b('Einstellungen: '), 'Lineatur (automatisch oder fest Lineatur 1, 2 oder 3), Vorlage in Grundschrift oder Druckschrift, Strenge der Bewertung.'),
    ),
    h('h3', null, 'So läuft eine Runde'),
    list(
      'Die Kinder schreiben unter der Kamera.',
      h('span', null, b('Enter'), ' oder der Knopf ', b('„Fertig!“'), ' machen sofort ein Foto. Leertaste und Presenter warten kurz, bis die Hände aus dem Bild sind. Es geht auch automatisch (👁).'),
      'Auf demselben Blatt kann weitergeschrieben werden: ausgewertet wird nur das Neue. Für ein frisches Blatt „Neues Blatt“ drücken (Taste N).',
      'Jedes Zeichen wird zu einem Wesen. Antippen zeigt das Zeichen groß mit einem Tipp.',
    ),
    h('h3', null, 'Die Spielarten'),
    list(
      h('span', null, b('Meer, Weltraum, Savanne: '), 'frei schreiben oder Buchstaben üben.'),
      h(
        'span',
        null,
        b('Buchstaben üben: '),
        'mehrere Buchstaben auswählen – sie kommen nacheinander dran (je 3, 5 oder 10×). Eine Vorlage zeigt, wie der Buchstabe geschrieben wird: mit Startpunkten, Pfeilen und Strichreihenfolge. Antippen zeigt die Vorführung groß. Ab und zu schwebt ein Überraschungs-Buchstabe in einer Blase herein.',
      ),
      h('span', null, b('Team-Duell: '), 'zwei Teams, die Buchstaben kämpfen um Seifenblasen-Burgen.'),
      h('span', null, b('Türme bauen: '), 'zwei bis acht Teams bauen um die Wette – schöne Buchstaben sind hohe Bausteine.'),
      h('span', null, b('Klasse gegen Riesenburg: '), 'die ganze Klasse gemeinsam gegen Riese Rumpel.'),
      h(
        'span',
        null,
        b('Mal-Aquarium: '),
        'hier wird gemalt statt geschrieben. Die Kopiervorlage (sechs Fische pro A4-Blatt) drucken Sie in der Spielvorbereitung aus. Jedes Kind malt seinen Fisch an und kann ihm unten einen Namen geben. Unter der Kamera schwimmt der Fisch dann mit genau diesen Farben los – ausgeschnitten oder als ganzes Blatt, Hauptsache der schwarze Rahmen ist ganz zu sehen. Noch weiße Fische und schon bekannte Karten zählen nicht doppelt.',
      ),
    ),
    h('h3', null, 'Weiterspielen, speichern, laden'),
    list(
      'Die App merkt sich das letzte Spiel jeder Spielart. Wählen Sie die Spielart wieder, fragt sie: weiterspielen oder neu beginnen? Auf der Startseite steht außerdem „▶ Weiterspielen“ für das zuletzt gespielte Spiel.',
      'Auch nach einem Neuladen der Seite oder am nächsten Tag geht es weiter – auf demselben Blatt zählt nur das Neue.',
      h('span', null, b('💾 im Spiel'), ' (oder Taste S) speichert das Spiel unter einem Namen, z. B. pro Klasse. Unter ', b('„📂 Spielstände“'), ' auf der Startseite laden, herunterladen oder löschen Sie es.'),
      'Als Datei heruntergeladen lässt sich ein Spiel auf einen anderen Computer mitnehmen („Datei öffnen …“).',
      'Gespeichert wird nur in diesem Browser. Auf gemeinsam genutzten Geräten lässt sich das automatische Merken in den Einstellungen ausschalten.',
    ),
    h('h3', null, 'Teams erkennen'),
    list(
      'An der Stiftfarbe oder an der Zettelfarbe. In der Spielvorbereitung „Farbe im Foto zeigen“ antippen: die Kamera macht ein Foto, Sie tippen auf einen Strich bzw. Zettel des Teams. Ist eine Farbe der eines anderen Teams zu ähnlich, wird gewarnt.',
      'Oder ganz ohne Farben: Taste 1 bis 8 (oder die Team-Knöpfe neben „Fertig!“) – das nächste Foto zählt komplett für dieses Team. Bei vielen Teams ist das der sicherste Weg.',
    ),
    h('h3', null, 'Wie bewertet wird'),
    p(
      'Das Spiel schaut, wie gut ein Zeichen lesbar ist, wie nah es an der Vorlage liegt, wie ruhig der Strich ist und wie groß und gerade es steht. Auf Lineatur zählt auch, ob der Buchstabe in die richtigen Bänder passt: kleine Buchstaben ins Mittelband, große bis zur Oberlinie, g, p, q und y bis zur Unterlinie. Die Strenge lässt sich einstellen.',
    ),
    p(
      b('Spiegelschrift: '),
      'Spiegelverkehrte Buchstaben (z. B. ein umgedrehtes S, Z, N oder eine umgedrehte 3) erkennt das Spiel. Normalerweise zählen sie mit weniger Sternen und dem Tipp „Dreh mich um“. Mit dem Kippschalter „Spiegelschrift zählt nicht“ in den Einstellungen zählen sie gar nicht: Es schlüpft kein Wesen und es gibt keinen Baustein. b/d und p/q sind gespiegelt echte Buchstaben und lassen sich nicht unterscheiden.',
    ),
    p(
      b('Wichtig: '),
      'Die Bewertung ist eine spielerische Rückmeldung, keine Note. Die Erkennung kann sich irren – besonders bei sehr kleiner Schrift, Schatten oder Buchstaben, die sich berühren.',
    ),
    h('h3', null, 'Tipps für die Klasse'),
    list('Etwas Platz zwischen den Buchstaben lassen.', 'Zettel im Duell auf eine dunkle Unterlage legen.', 'Kinder wechseln sich unter der Kamera ab – die anderen feuern an.'),
  );
}

function parents(): HTMLElement {
  return h(
    'div',
    null,
    p('Zu Hause genügt ein Laptop mit Webcam. Stellen Sie ihn so, dass die Kamera auf das Blatt schaut – zum Beispiel aufgeklappt hinter einem Bücherstapel – und richten Sie unter „Kamera einrichten“ den Ausschnitt ein.'),
    h('h3', null, 'So macht es Spaß'),
    list(
      'Lieber kurz und oft: zehn Minuten reichen.',
      'Die Buchstaben üben, die gerade in der Schule dran sind. Bei „Buchstaben üben“ können Sie mehrere auswählen; sie kommen nacheinander.',
      'Die Vorlage zeigt, wo man anfängt und in welche Richtung der Stift läuft – so wie in der Schule. Schulen und Schreiblehrgänge unterscheiden sich manchmal leicht; im Zweifel gilt, was die Lehrkraft zeigt.',
      'Wenn das Kind ein Heft mit Lineatur hat: genau darauf schreiben lassen. Die App achtet dann auch darauf, ob die Buchstaben in die Linien passen.',
    ),
    h('h3', null, 'Loben Sie die Mühe'),
    p(
      'Zerknitterte, schiefe Wesen sind lustig, nicht schlecht. Freuen Sie sich mit Ihrem Kind über jede Krone – und über jedes Wesen, das „nur“ freundlich ist. Die Tipps der Wesen („Bäuche schön zumachen!“, „Genau bis an die Linien schreiben!“) sind kleine Hinweise, keine Kritik.',
    ),
    p('Die Bewertung ist eine spielerische Rückmeldung und kann sich auch einmal irren.'),
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
      row('Enter / „Fertig!“', 'Foto sofort'),
      row('Leertaste, Bild↓, Pfeil → (Presenter)', 'Foto, sobald die Hände aus dem Bild sind'),
      row('1 bis 8 / Team-Knöpfe', 'Foto sofort – alle Zeichen gehören zu diesem Team (Duell: 1, 2; Türme: bis 8)'),
      row('N', 'Neues Blatt (alles gilt wieder als neu)'),
      row('A', 'Automatisch scannen an/aus'),
      row('F', 'Vollbild'),
      row('S', 'Spiel speichern (unter einem Namen oder als Datei)'),
      row('Esc', 'Pause und Menü'),
    ),
    h('h3', null, 'Mit Touch (Tablet, Touch-Bildschirm, Whiteboard)'),
    list(
      'Alles hat auch einen Knopf: „Fertig!“, Team-Knöpfe, Neues Blatt, Automatik (👁), Speichern (💾), Vollbild (⛶), Menü (⌂).',
      'Ein Wesen antippen zeigt das Zeichen groß mit Tipp – im Mal-Aquarium den Fisch mit seinem Namen.',
      'Die kleine Schreib-Vorlage oben antippen zeigt die große Vorführung.',
      'Teamfarben werden im Foto angetippt.',
    ),
  );
}

function privacy(close: () => void): HTMLElement {
  return h(
    'div',
    null,
    list(
      'Die Kamerabilder werden nur auf diesem Gerät ausgewertet – nichts wird verschickt. Die Fotos selbst werden nicht gespeichert.',
      'Keine Konten, keine Cookies, kein Tracking, keine Werbung.',
      'Gespeichert werden in diesem Browser die Einstellungen (z. B. Teamnamen, Übungsbuchstaben) und die Spielstände: die ausgeschnittenen Buchstaben und die ausgemalten Fische (mit dem Fischnamen, falls einer daraufsteht). Löschen: „📂 Spielstände“ oder Einstellungen → „Alle Spielstände löschen“.',
      'Bitte die Kamera nur auf das Papier richten und als Teamnamen keine Namen von Kindern verwenden. Auf die Fisch-Karten gehört ein Fischname, nicht der Name des Kindes.',
    ),
    h(
      'div',
      { class: 'actions' },
      button('Datenschutzerklärung lesen', () => {
        close();
        void openLegal('datenschutz');
      }, 'btn small'),
    ),
  );
}

export function openGuide(): void {
  const body = h('div', { class: 'guide' });
  const show = (t: Tab) => {
    clear(body);
    body.append(t === 'lehrer' ? teachers() : t === 'eltern' ? parents() : t === 'tasten' ? keys() : privacy(() => m.close()));
  };
  const content = h(
    'div',
    { style: 'max-width:820px' },
    h('h2', null, '👩‍🏫 Für Lehrer und Eltern'),
    p(
      'Krakel & Krone macht Schreibübungen zum Spiel: Die Kinder schreiben mit Stift auf Papier, eine Kamera fotografiert das Blatt, und aus jedem Buchstaben wird ein kleines Wesen. Je sorgfältiger geschrieben, desto prächtiger das Wesen – Krakel werden zu lustigen, zerknitterten Wesen. Jedes Zeichen bekommt ein Wesen und einen freundlichen Tipp. Im Mal-Aquarium wird gemalt statt geschrieben: Ausgemalte Fische schwimmen in ihren eigenen Farben.',
    ),
    segmented(
      [
        { value: 'lehrer', label: 'Lehrkräfte' },
        { value: 'eltern', label: 'Eltern' },
        { value: 'tasten', label: 'Tasten & Touch' },
        { value: 'daten', label: 'Datenschutz' },
      ],
      'lehrer' as Tab,
      show,
    ),
    body,
    h('div', { class: 'actions' }, button('Alles klar!', () => m.close(), 'btn primary')),
  );
  show('lehrer');
  const m = modal(content);
}
