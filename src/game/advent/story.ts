// A little story behind every door of the advent calendar, read aloud when the door opens. Each one stands on
// its own (no serial) and tells what the figure of the day (SURPRISES in surprises.ts) gets up to, ending in
// the gag that plays. The narrator tells, Flocke and the figure each say one line. Texts are German keys (tk).
import { tk } from '../../i18n/i18n.ts';

export interface StoryDay {
  title: string;
  /** read by the narrator, one sentence after the other */
  narration: string[];
  /** what the figure of the day says */
  figure: string;
  /** what Flocke says at the end */
  flocke: string;
}

export const STORIES: StoryDay[] = [
  {
    title: tk('Rolf und der Puderzucker'),
    narration: [
      tk('Rentier Rolf hilft in der Weihnachtsbäckerei.'),
      tk('Er soll ganz vorsichtig Puderzucker auf die Plätzchen streuen.'),
      tk('Aber der Puderzucker staubt und staubt – direkt in Rolfs Nase.'),
      tk('Seine Nase kribbelt, sie kitzelt, sie zuckt …'),
    ],
    figure: tk('Ha… ha… HATSCHI!'),
    flocke: tk('Gesundheit, Rolf! Jetzt ist die ganze Küche bunt!'),
  },
  {
    title: tk('Paula will nicht warten'),
    narration: [
      tk('Paula ist ein Geschenk mit einer goldenen Schleife.'),
      tk('Sie soll ganz still unter dem Weihnachtsbaum liegen und warten.'),
      tk('Aber Paula ist so aufgeregt, dass sie einfach nicht stillhalten kann.'),
      tk('Hüpf, hüpf, hüpf – und weg ist sie!'),
    ],
    figure: tk('Ich bin gleich wieder da!'),
    flocke: tk('Paula, zurück unter den Baum! Weihnachten ist erst in ein paar Tagen!'),
  },
  {
    title: tk('Wim, der große Jongleur'),
    narration: [
      tk('Wichtel Wim hat im Zirkus zugeschaut und will jetzt auch jonglieren.'),
      tk('Er nimmt drei glänzende Christbaumkugeln.'),
      tk('Eine Kugel fliegt hoch, die zweite fliegt hoch, die dritte fliegt hoch …'),
      tk('Und eine kommt nicht wieder runter. Oder doch?'),
    ],
    figure: tk('Schaut mal, ich kann das!'),
    flocke: tk('Bonk! Zum Glück hat Wim eine dicke Mütze auf.'),
  },
  {
    title: tk('Hoppel hat Schluckauf'),
    narration: [
      tk('Schneehase Hoppel hat viel zu schnell seine Möhre gegessen.'),
      tk('Jetzt hat er Schluckauf, und bei jedem Hicks hüpft er in die Luft.'),
      tk('Er hält die Luft an, er trinkt Wasser, er steht auf einem Bein.'),
      tk('Nichts hilft. Bis jemand ganz laut „Buh!“ ruft.'),
    ],
    figure: tk('Hicks! Hilfe! Hicks!'),
    flocke: tk('Buh! … Siehst du, Hoppel? Weg ist er!'),
  },
  {
    title: tk('Pino nimmt die Abkürzung'),
    narration: [
      tk('Pinguin Pino will zum Weihnachtsmarkt.'),
      tk('Zu Fuß watschelt er aber sooo langsam.'),
      tk('Da hat Pino eine Idee: Er legt sich auf den Bauch.'),
      tk('Und los geht die Rutschpartie quer durch den Schnee!'),
    ],
    figure: tk('Juhuuu! Wer braucht schon einen Schlitten?'),
    flocke: tk('Pino, bremsen! Da vorne ist der Weihnachtsmarkt!'),
  },
  {
    title: tk('Krümel und der Nikolaus'),
    narration: [
      tk('Heute ist Nikolaustag!'),
      tk('Lebkuchenmann Krümel hat gestern Abend seinen Stiefel ganz blank geputzt.'),
      tk('In der Nacht hört er etwas poltern, oben am Schornstein.'),
      tk('Am Morgen steht da ein riesiger Stiefel voller Goldtaler.'),
    ],
    figure: tk('Der Nikolaus war da! Und er hat mir eine Mütze dagelassen!'),
    flocke: tk('Frohen Nikolaus, Krümel! Teilst du die Goldtaler mit uns?'),
  },
  {
    title: tk('Schnuppis Nase'),
    narration: [
      tk('Schneemann Schnuppi ist sehr stolz auf seine schöne Karottennase.'),
      tk('Doch heute ist es kalt und windig, und Schnuppi muss niesen.'),
      tk('Die Nase fliegt in hohem Bogen davon.'),
      tk('Und wer wartet schon mit großen Ohren? Ein hungriger Hase!'),
    ],
    figure: tk('Halt! Das ist meine Nase!'),
    flocke: tk('Keine Sorge, Schnuppi. Er bringt sie zurück – ein bisschen angeknabbert.'),
  },
  {
    title: tk('Krümel tanzt'),
    narration: [
      tk('Im Kalenderhaus ist Musik, und Lebkuchenmann Krümel tanzt los.'),
      tk('Er dreht sich, er hüpft, er wackelt mit den Armen.'),
      tk('Plopp! Da springt ihm ein Zuckerknopf vom Bauch.'),
      tk('Der Knopf rollt und rollt und rollt.'),
    ],
    figure: tk('Mein Knopf! Komm zurück!'),
    flocke: tk('Lauf, Krümel, lauf! Der Knopf ist schneller als du!'),
  },
  {
    title: tk('Wim backt Plätzchen'),
    narration: [
      tk('Wichtel Wim will die besten Plätzchen der Welt backen.'),
      tk('Er rührt den Teig, er knetet den Teig, er schaut ganz tief in die Schüssel.'),
      tk('Ein bisschen zu tief.'),
      tk('Platsch! Eine riesige Mehlwolke steigt auf.'),
    ],
    figure: tk('Huch! Bin ich jetzt ein Schneewichtel?'),
    flocke: tk('Wim, du bist ja ganz weiß! Wie ein kleines Gespenst!'),
  },
  {
    title: tk('Bruno ist müde'),
    narration: [
      tk('Eisbär Bruno hat die ganze Nacht Schneeflocken gezählt.'),
      tk('Jetzt ist er so müde, dass ihm im Stehen die Augen zufallen.'),
      tk('Er schnarcht, und vor seiner Nase wächst eine riesige Schnarchblase.'),
      tk('Sie wird größer und größer und größer …'),
    ],
    figure: tk('Chrrr … pfiii … chrrr …'),
    flocke: tk('Plopp! Guten Morgen, Bruno!'),
  },
  {
    title: tk('Rolf übt fliegen'),
    narration: [
      tk('Rentier Rolf muss für Heiligabend das Fliegen üben.'),
      tk('Er nimmt Anlauf, er springt, und er fliegt!'),
      tk('Er fliegt sogar einen Looping, so toll ist er.'),
      tk('Nur das Landen hat er noch nicht geübt.'),
    ],
    figure: tk('Achtung, ich komme runter!'),
    flocke: tk('Plumps! Rolf steckt kopfüber im Schnee. Das Landen üben wir morgen.'),
  },
  {
    title: tk('Die Schneeballschlacht'),
    narration: [
      tk('Schneehase Hoppel hat den perfekten Schneeball gebaut.'),
      tk('Er ist rund, er ist fest, er ist genau richtig.'),
      tk('Hoppel zielt auf den Baum. Er wirft.'),
      tk('Aber der Schneeball fliegt nicht zum Baum.'),
    ],
    figure: tk('Ups! Das wollte ich nicht!'),
    flocke: tk('Pfff! Hoppel, ich habe Schnee in der Nase!'),
  },
  {
    title: tk('Pino auf dem Eis'),
    narration: [
      tk('Pinguin Pino will Eiskunstläufer werden.'),
      tk('Er dreht eine Pirouette, noch eine, und noch eine.'),
      tk('So schnell hat sich noch nie ein Pinguin gedreht.'),
      tk('Dann bleibt er stehen. Aber die Welt dreht sich weiter.'),
    ],
    figure: tk('Huiii, alles dreht sich!'),
    flocke: tk('Pino sieht Sterne. Und das am helllichten Tag!'),
  },
  {
    title: tk('Paula rappelt'),
    narration: [
      tk('Unter dem Baum liegt Paula, das Geschenk.'),
      tk('Plötzlich rappelt es in ihr. Rumpel, rumpel, rumpel.'),
      tk('Was da wohl drin ist?'),
      tk('Der Deckel springt auf – und heraus kommt eine Sprungfeder!'),
    ],
    figure: tk('Kuckuck! Überraschung!'),
    flocke: tk('Huch! Paula, du hast mich vielleicht erschreckt!'),
  },
  {
    title: tk('Bruno hat Schluckauf'),
    narration: [
      tk('Eisbär Bruno hat zu schnell sein Eis gegessen.'),
      tk('Jetzt hat er einen ganz großen Bären-Schluckauf.'),
      tk('Bei jedem Hicks springen kleine Sterne aus seinem Mund.'),
      tk('Das sieht schön aus, aber es kitzelt.'),
    ],
    figure: tk('Hicks! Das ist gar nicht so schlimm! Hicks!'),
    flocke: tk('Bruno, du bist der erste Eisbär mit Sternchen-Schluckauf!'),
  },
  {
    title: tk('Schnuppi ist erkältet'),
    narration: [
      tk('Schneemann Schnuppi hat sich erkältet.'),
      tk('Ein Schneemann mit Schnupfen? Das gibt es!'),
      tk('Seine Karottennase läuft, und er muss ganz doll niesen.'),
      tk('Aber aus Schnuppi kommen keine Tropfen, sondern Schneeflocken.'),
    ],
    figure: tk('HATSCHI! Oh, es schneit!'),
    flocke: tk('Gesundheit, Schnuppi! Du bist ja eine richtige Schneemaschine!'),
  },
  {
    title: tk('Krümel, der Zauberer'),
    narration: [
      tk('Lebkuchenmann Krümel will der Klasse ein Kunststück zeigen.'),
      tk('Er jongliert mit drei Zuckerperlen.'),
      tk('Er wird immer schneller und immer mutiger.'),
      tk('Bis eine Perle genau auf seinem Kopf landet.'),
    ],
    figure: tk('Tadaaa! … Aua.'),
    flocke: tk('Bravo, Krümel! Fast hat es geklappt!'),
  },
  {
    title: tk('Krümel im Teig'),
    narration: [
      tk('Lebkuchenmann Krümel besucht die Weihnachtsbäckerei.'),
      tk('Er will nur ganz kurz in die Teigschüssel schauen.'),
      tk('Da rutscht er aus – und landet mitten im Mehl.'),
      tk('Wie sieht er jetzt bloß aus?'),
    ],
    figure: tk('Bin ich jetzt ein Lebkuchen mit Zuckerguss?'),
    flocke: tk('Krümel, du siehst aus wie ein Schneelebkuchen!'),
  },
  {
    title: tk('Bruno rutscht'),
    narration: [
      tk('Eisbär Bruno hat Pino beim Bauchrutschen zugeschaut.'),
      tk('Das will er auch können!'),
      tk('Er nimmt Anlauf, legt sich auf seinen dicken Bauch und saust los.'),
      tk('Ein Eisbär rutscht allerdings viel weiter als ein Pinguin.'),
    ],
    figure: tk('Platz da! Hier kommt der Bärenschlitten!'),
    flocke: tk('Bruno, du bist ja bis ans Ende des Bildes gerutscht!'),
  },
  {
    title: tk('Rolf, der Tänzer'),
    narration: [
      tk('Rentier Rolf will beim Weihnachtsball tanzen.'),
      tk('Er übt eine Drehung, mit seinem Geweih ganz hoch in der Luft.'),
      tk('Eine Drehung, zwei Drehungen, drei Drehungen.'),
      tk('Zum Glück hat das Geweih keine Lichterkette gefangen.'),
    ],
    figure: tk('Darf ich bitten?'),
    flocke: tk('Rolf, du tanzt ja schöner als jeder Wichtel!'),
  },
  {
    title: tk('Schnuppi wirft zurück'),
    narration: [
      tk('Schneemann Schnuppi hat genug von den Schneebällen der anderen.'),
      tk('Heute baut er selbst einen, so groß wie sein eigener Kopf.'),
      tk('Er holt Schwung und wirft.'),
      tk('Rate mal, wer schon wieder getroffen wird.'),
    ],
    figure: tk('Hihi, Volltreffer!'),
    flocke: tk('Schon wieder ich?! Warum immer ich?'),
  },
  {
    title: tk('Wim schläft ein'),
    narration: [
      tk('Wichtel Wim hat die ganze Nacht Geschenke eingepackt.'),
      tk('Hundert Geschenke, mit Papier, mit Band und mit Schleife.'),
      tk('Jetzt ist er so müde, dass er im Stehen einschläft.'),
      tk('Seine Schnarchblase ist fast so groß wie er selbst.'),
    ],
    figure: tk('Chrrr … noch eine Schleife … chrrr …'),
    flocke: tk('Pssst! Lasst Wim schlafen. Er hat sich das verdient.'),
  },
  {
    title: tk('Schnuppis Nase, schon wieder'),
    narration: [
      tk('Schneemann Schnuppi hat seine Nase extra gut festgedrückt.'),
      tk('Diesmal soll sie nicht wegfliegen.'),
      tk('Aber da kommt schon wieder der Hase vorbei.'),
      tk('Und Schnuppi muss schon wieder niesen.'),
    ],
    figure: tk('Nicht schon wieder! Hatschi!'),
    flocke: tk('Der Hase hat wohl Hunger auf Karotten. Morgen bekommt er eine eigene!'),
  },
  {
    title: tk('Heiligabend'),
    narration: [
      tk('Heute ist Heiligabend!'),
      tk('Alle Figuren aus allen 24 Türchen kommen vor das Kalenderhaus.'),
      tk('Rolf, Paula, Wim, Hoppel, Pino, Krümel, Schnuppi und Bruno.'),
      tk('Der Stern auf dem Dach leuchtet so hell wie noch nie.'),
      tk('Und alle tanzen zusammen im Schnee.'),
    ],
    figure: tk('Frohe Weihnachten, liebe Kinder!'),
    flocke: tk('Ihr habt alle 24 Türchen geschafft. Ihr seid die Besten!'),
  },
];
