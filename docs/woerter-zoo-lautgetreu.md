# Wörter-Zoo: lautgetreue Schreibungen

Schreibanfänger schreiben, was sie hören: „Fogel“, „Hunt“, „Schtern“, „Tiga“. Im Startfenster des Wörter-Zoos stellt die Lehrkraft ein, wie damit umgegangen wird:

- **Lautgetreu zählt:** Das Wort ist geschafft. Danach steht die richtige Schreibung groß auf der Karte, die Stimme sagt „Gut gehört – das zählt! So schreibt man es richtig.“
- **Nur richtig geschrieben** (Vorgabe): „Gut gehört!“ mit der geschriebenen und der richtigen Schreibung untereinander; das Wort wird noch einmal geschrieben (nach dem dritten Versuch zählt es trotzdem).

Groß- und Kleinschreibung spielt bei „Lautgetreu zählt“ keine Rolle.

## Wie geprüft wird

Beide Schreibungen – die richtige und die geschriebene – werden in eine **Lautform** übersetzt (`soundKey` in `src/game/words/lautgetreu.ts`). Stimmen die Lautformen überein, ist die Schreibung lautgetreu. Die Regeln in ihrer Reihenfolge:

| Regel | Beispiel |
|---|---|
| ß → s | Fuß → Fus |
| sch vor t/p am Wortanfang → s | Schtern → Stern, Schpinne → Spinne |
| chs, x → ks | Fuchs = Fuks = Fux |
| ph, v, pf → f | Elephant = Elefant, Fogel = Vogel, Afel = Apfel |
| qu → kw | Kwalle = Qualle |
| ck → k, tz und ts → z, dt → t | Schneke = Schnecke, Kaze = Katse = Katze |
| äu, eu, oi klingen gleich; ei, ai klingen gleich | Oile = Eule, Ais = Eis |
| ie, ih → i; ä → e | Bine = Biene, Ber = Bär |
| Dehnungs-h nach einem Vokal fällt weg | Schu = Schuh, Zan = Zahn, Ur = Uhr |
| doppelte Vokale und Konsonanten → einfach | Waal = Wal, Bal = Ball, Pupe = Puppe |
| gu vor einem Vokal → gw | Pingwin = Pinguin |
| -er am Wortende → a; -el, -en → l, n | Tiga = Tiger, Nudl = Nudel, Kuchn = Kuchen |
| b, d, g am Wortende und vor einem Konsonanten → p, t, k | Hunt = Hund, Burk = Burg |

Was die Regeln nicht erreichen (z. B. „Schiraffe“), steht in der **Prüfliste** unten und zählt von dort.

Nicht lautgetreu – und darum nicht „richtig“ – ist eine Schreibung, in der ein Laut fehlt oder falsch ist: „Ent“ (Ente), „Hnd“ (Hund), „Pils“ (Pilz: z klingt ts).

## Prüfliste

Für jedes Wort die bekannten lautgetreuen Schreibungen von Erstklässlern. Der Test `test/game/lautgetreu.test.ts` gleicht jedes Wort gegen seine Liste ab: jede Schreibung muss als lautgetreu zählen, keine darf für ein anderes Wort zählen, und keine zwei Wörter des Zoos haben dieselbe Lautform.

| Stufe | Wort | Lautform | bekannte lautgetreue Schreibungen |
|---:|---|---|---|
| 1 | Oma | `oma` | Ohma |
| 1 | Opa | `opa` | Ohpa |
| 1 | Mama | `mama` | – |
| 1 | Papa | `papa` | – |
| 1 | Eis | `æs` | Ais |
| 1 | Ei | `æ` | Ai |
| 1 | Ast | `ast` | Asst |
| 1 | Ente | `ente` | Ennte |
| 1 | Esel | `esl` | Esl, Ehsel |
| 1 | Igel | `igl` | Iegel, Igl |
| 1 | Nase | `nase` | Nahse |
| 1 | Rose | `rose` | Rohse |
| 1 | Sofa | `sofa` | Sohfa, Sova |
| 1 | Limo | `limo` | Liemo |
| 1 | Lama | `lama` | Lahma |
| 1 | Maus | `mås` | – |
| 1 | Mond | `mont` | Mont, Mohnt |
| 1 | Nest | `nest` | Nesst |
| 1 | Hut | `hut` | Huht |
| 1 | Hose | `hose` | Hohse |
| 1 | Tor | `tor` | Tohr |
| 1 | Eule | `ɔle` | Oile, Euhle |
| 1 | Auto | `åto` | – |
| 1 | Wal | `wal` | Wahl, Waal |
| 1 | Dino | `dino` | Dieno |
| 1 | Rabe | `rabe` | Rahbe |
| 1 | Nudel | `nudl` | Nudl, Nuhdel |
| 1 | Tomate | `tomate` | Tomahte |
| 2 | Hund | `hunt` | Hunt |
| 2 | Hase | `hase` | Hahse |
| 2 | Lampe | `lampe` | – |
| 2 | Tulpe | `tulpe` | – |
| 2 | Ampel | `ampl` | Ampl |
| 2 | Kerze | `kerze` | Kertse, Kärze |
| 2 | Krone | `krone` | Krohne |
| 2 | Zebra | `zebra` | Tsebra, Zehbra |
| 2 | Tiger | `tiga` | Tieger, Tiga |
| 2 | Banane | `banane` | Banahne |
| 2 | Blume | `blume` | Bluhme |
| 2 | Wolke | `wolke` | Wolcke |
| 2 | Burg | `burk` | Burk |
| 2 | Brot | `brot` | Broht, Brod |
| 2 | Rad | `rat` | Rat, Raad |
| 2 | Bus | `bus` | Buss |
| 2 | Gras | `gras` | Grahs, Graas |
| 2 | Kran | `kran` | Krahn |
| 2 | Ameise | `amæse` | Amaise |
| 2 | Leiter | `læta` | Laita, Leita |
| 2 | Gurke | `gurke` | Gurcke |
| 2 | Löwe | `löwe` | – |
| 2 | Bär | `ba` | Ber, Bähr |
| 2 | Zelt | `zelt` | Tselt |
| 2 | Pilz | `pilz` | Pilts |
| 2 | Kamel | `kaml` | Kamehl |
| 2 | Melone | `melone` | Mehlone |
| 2 | Rakete | `rakete` | Rakehte |
| 3 | Apfel | `afl` | Afel, Apfl |
| 3 | Fisch | `fiš` | – |
| 3 | Schaf | `šaf` | Schahf |
| 3 | Biene | `bine` | Bine |
| 3 | Katze | `kaze` | Kaze, Katse |
| 3 | Schule | `šule` | Schuhle |
| 3 | Buch | `buç` | – |
| 3 | Kuchen | `kuçn` | Kuchn, Kuhchen |
| 3 | Frosch | `froš` | – |
| 3 | Fuchs | `fuks` | Fuks, Fux |
| 3 | Stern | `stern` | Schtern |
| 3 | Schnecke | `šneke` | Schneke |
| 3 | Ball | `bal` | Bal |
| 3 | Puppe | `pupe` | Pupe |
| 3 | Schiff | `šif` | Schif |
| 3 | Giraffe | `girafe` | Schiraffe, Schirafe, Girafe |
| 3 | Pinguin | `pingwin` | Pingwin, Pinguihn |
| 3 | Elefant | `elefant` | Elefand, Elephant |
| 3 | Drache | `draçe` | – |
| 3 | Brille | `brile` | Brile |
| 3 | Schuh | `šu` | Schu |
| 3 | Kuh | `ku` | Ku |
| 3 | Uhr | `ur` | Ur |
| 3 | Zahn | `zan` | Zan, Tsan |
| 3 | Ziege | `zige` | Zige, Tsige |
| 3 | Spinne | `spine` | Schpinne, Schpine, Spine |
| 3 | Affe | `afe` | Afe |

Neue Schreibungen, die in der Klasse auffallen: in `KNOWN_SPELLINGS` eintragen, `npx vitest run test/game/lautgetreu.test.ts` prüft sie, `npx vite-node tools/lautgetreu-doc.ts` schreibt dieses Dokument neu.
