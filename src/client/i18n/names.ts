// Polish item names. The server composes English names ("Jagged Ruststeel Sword of the Hornet",
// "Ember Bite"); the client rebuilds them in Polish from the same parts:
//   - a base name is written head noun first, so its grammatical gender is known from the first word;
//   - a prefix is either an adjective (masculine form here, inflected to the base's gender and put
//     in front) or, marked with "~", a genitive phrase that follows the base and needs no agreement;
//   - a suffix ("of the X") is always a genitive phrase after the base;
//   - two genitive phrases are joined with "i":  "Topór Drwala Rzeźnika i Szubienicy";
//   - rare names "A B" become "B (nominative) A (genitive)":  "Ember Bite" -> "Ukąszenie Żaru".
// All names are this game's own.

type G = "m" | "f" | "n" | "p"; // p = plural (rękawice, buty)

/** Gender of the head nouns used below (anything missing is masculine). */
const HEAD: Record<string, G> = {
  Szabla: "f", Klinga: "f", Maczuga: "f", Buława: "f", Włócznia: "f", Lanca: "f", Pika: "f", Partyzana: "f", Różdżka: "f", Kusza: "f",
  Tarcza: "f", Osłona: "f", Pawęż: "f", Egida: "f", Kula: "f", Korona: "f", Czapa: "f", Kolczuga: "f", Zbroja: "f", Szata: "f",
  Brygantyna: "f", Obrączka: "f", Przepaska: "f", Fiolka: "f", Runa: "f", Tyka: "f",
  Berło: "n", Okrycie: "n", Odzienie: "n", Kółko: "n",
  Szpony: "p", Rogi: "p", Regalia: "p", Rękawice: "p", Owijki: "p", Trzewiki: "p", Nagolenniki: "p", Buty: "p", Pantofle: "p",
};

/** English base name -> Polish ("...|g" overrides the gender when the head noun is not the first word). */
export const BASE_PL: Record<string, string> = {
  // swords
  "Ruststeel Sword": "Miecz z Rdzawej Stali", "Chapel Shortsword": "Kord Kapliczny", "Gallowsedge Blade": "Klinga Szubieniczna",
  "Oathbreaker Sabre": "Szabla Krzywoprzysięzcy", "Vigil Longsword": "Długi Miecz Czuwania|m",
  // axes
  "Woodsplitter Axe": "Topór Drwala", "Bearded Hatchet": "Toporek Brodaty", "Grievance Axe": "Topór Urazy", "Widowmaker Axe": "Topór Siewcy Wdów",
  "Headsman's Cleaver": "Tasak Kata",
  // maces
  "Knotwood Club": "Maczuga Sękata", "Flanged Mace": "Buzdygan Piórowy", "Bellhammer": "Młot Dzwonny", "Penitent Morningstar": "Morgensztern Pokutnika",
  "Reliquary Mace": "Buława Relikwiarzowa",
  // daggers
  "Wick Knife": "Nóż do Knotów", "Gutting Knife": "Nóż do Patroszenia", "Moonsliver Dirk": "Puginał Księżycowego Sierpa", "Mercy Stiletto": "Sztylet Miłosierdzia",
  "Veilpiercer": "Przebijacz Zasłon",
  // claws
  "Rag Talon": "Szpon w Łachmanach", "Hooked Grip": "Chwyt Hakowy", "Carrion Hook": "Hak Padlinożercy", "Nightjar Talons": "Szpony Lelka", "Ravener Claw": "Pazur Żarłoka",
  // spears
  "Thornwood Spear": "Włócznia z Cierniodrzewu", "Boar Lance": "Oszczep na Dzika", "Wyrmtooth Pike": "Pika Smoczego Zęba", "Harrow Partisan": "Partyzana Udręki",
  "Skyrend Spear": "Włócznia Rozdartego Nieba",
  // sceptres
  "Acolyte's Rod": "Pręt Akolity", "Bone Sceptre": "Berło Kościane", "Cinder Sceptre": "Berło Zgliszcz", "Abbess Sceptre": "Berło Ksieni", "Eclipse Sceptre": "Berło Zaćmienia",
  // wands
  "Twig Wand": "Różdżka z Gałązki", "Fingerbone Wand": "Różdżka z Paliczka", "Ashen Wand": "Różdżka Popielna", "Gloam Wand": "Różdżka Zmierzchu",
  "Starhook Wand": "Różdżka Gwiezdnego Haka",
  // two-handed
  "Pilgrim Greatblade": "Wielki Miecz Pielgrzyma|m", "Executioner Blade": "Miecz Katowski", "Cathedral Zweihander": "Dwuręczniak Katedralny", "Dusk Claymore": "Claymore Zmierzchu",
  "Timber Greataxe": "Wielki Topór Ciesielski|m", "Gravedigger Axe": "Topór Grabarza", "Butcher Poleaxe": "Berdysz Rzeźnika", "Ruin Greataxe": "Wielki Topór Zguby|m",
  "Mallet of Toil": "Pobijak Znoju", "Anvil Maul": "Młot Kowadłowy", "Tollbell Hammer": "Młot Żałobnego Dzwonu", "Sepulchre Maul": "Młot Grobowy",
  "Ashpole": "Tyka Jesionowa", "Ironshod Pole": "Drąg Okuty Żelazem", "Pilgrim Quarterstaff": "Kij Pielgrzymi", "Wardancer Staff": "Kij Tancerza Wojny",
  "Tempest Quarterstaff": "Kij Nawałnicy",
  "Gnarled Staff": "Kostur Sękaty", "Hollow Staff": "Kostur Wydrążony", "Vesper Staff": "Kostur Nieszporny", "Occultist Staff": "Kostur Okultysty",
  "Moonwell Staff": "Kostur Księżycowej Studni",
  "Yew Shortbow": "Krótki Łuk Cisowy|m", "Hunter's Recurve": "Łuk Refleksyjny Myśliwego", "Thornstring Bow": "Łuk o Cierniowej Cięciwie",
  "Ravenwing Longbow": "Długi Łuk Kruczego Skrzydła|m", "Gallows Warbow": "Łuk Wojenny Szubienicznika",
  "Latch Crossbow": "Kusza Zapadkowa", "Windlass Crossbow": "Kusza z Kołowrotem", "Siege Arbalest": "Arbalet Oblężniczy", "Bastion Arbalest": "Arbalet Bastionowy",
  "Requiem Crossbow": "Kusza Żałobna",
  // off-hand
  "Hide Buckler": "Puklerz Skórzany", "Studded Buckler": "Puklerz Ćwiekowany", "Fencer's Buckler": "Puklerz Szermierza", "Mirrorpoint Buckler": "Puklerz Lustrzany",
  "Bough Targe": "Tarcza z Konarów", "Iron-rim Targe": "Tarcza z Żelaznym Obrzeżem", "Raider Roundshield": "Tarcza Okrągła Najeźdźcy",
  "Ironbound Ward": "Osłona Okuta Żelazem", "Chapter Kiteshield": "Tarcza Migdałowa Kapituły", "Seraph Crest": "Herb Serafina",
  "Plank Pavise": "Pawęż z Desek", "Rampart Shield": "Tarcza Wałowa", "Bulwark Tower": "Tarcza Wieżowa Przedmurza", "Gatekeeper Aegis": "Egida Odźwiernego",
  "Candle Focus": "Fokus Świecowy", "Glass-eye Focus": "Fokus Szklanego Oka", "Ossuary Focus": "Fokus z Ossuarium", "Nightglass Orb": "Kula z Nocnego Szkła",
  "Sackcloth Quiver": "Kołczan Zgrzebny", "Fletcher's Quiver": "Kołczan Łuczarza", "Barbed Quiver": "Kołczan Zadziorny", "Whisperfeather Quiver": "Kołczan Szepczących Piór",
  // helmets
  "Kettle Helm": "Kapalin", "Nasal Helm": "Hełm z Nosalem", "Visored Helm": "Hełm z Zasłoną", "Crowned Greathelm": "Hełm Wielki z Koroną",
  "Ragged Hood": "Kaptur Postrzępiony", "Poacher's Hood": "Kaptur Kłusownika", "Shade Cowl": "Kaptur Cienia", "Nightstalker Hood": "Kaptur Nocnego Tropiciela",
  "Copper Circlet": "Diadem Miedziany", "Thorn Diadem": "Diadem Cierniowy", "Moonsilver Circlet": "Diadem z Księżycowego Srebra", "Seer's Crown": "Korona Wieszcza",
  "Horned Cap": "Czapa Rogata", "Raider Helm": "Hełm Najeźdźcy", "Warlord Horns": "Rogi Watażki",
  "Templar Bascinet": "Basinet Templariusza", "Choir Helm": "Hełm Chórzysty", "Reliquary Greathelm": "Hełm Wielki Relikwiarza",
  "Leather Coif": "Czepiec Skórzany", "Mystic Headwrap": "Zawój Mistyka", "Veiled Coif": "Czepiec z Woalem",
  // body armour
  "Riveted Jerkin": "Kaftan Nitowany", "Chain Hauberk": "Kolczuga Długa", "Bastion Plate": "Zbroja Bastionowa", "Gravewarden Plate": "Zbroja Strażnika Grobów",
  "Patchwork Jerkin": "Kaftan Łatany", "Poacher's Jerkin": "Kaftan Kłusownika", "Scaled Hauberk": "Zbroja Łuskowa", "Wyrmhide Coat": "Płaszcz ze Smoczej Skóry",
  "Novice Robe": "Szata Nowicjusza", "Vesper Vestment": "Ornat Nieszporny", "Occult Regalia": "Regalia Okultysty", "Starweave Robe": "Szata z Gwiezdnej Przędzy",
  "Mercenary Brigandine": "Brygantyna Najemnika", "Raider Lamellar": "Zbroja Lamelkowa Najeźdźcy", "Warlord Brigandine": "Brygantyna Watażki",
  "Templar Tabard": "Tabard Templariusza", "Choir Vestplate": "Napierśnik Chórzysty", "Sanctified Plate": "Zbroja Poświęcona",
  "Wanderer's Wrap": "Okrycie Wędrowca", "Mistscale Coat": "Płaszcz z Mglistych Łusek", "Duskweave Raiment": "Odzienie ze Zmierzchowej Przędzy",
  // gloves
  "Tin Gauntlets": "Rękawice Blaszane", "Riveted Gauntlets": "Rękawice Nitowane", "Spiked Gauntlets": "Rękawice Kolczaste", "Warden Gauntlets": "Rękawice Strażnika",
  "Hide Gloves": "Rękawice Skórzane", "Archer's Gloves": "Rękawice Łucznika", "Ghostgrip Gloves": "Rękawice Upiornego Chwytu", "Silkstring Gloves": "Rękawice Jedwabnej Cięciwy",
  "Linen Gloves": "Rękawice Lniane", "Chanter's Gloves": "Rękawice Kantora", "Sigil Gloves": "Rękawice Pieczęci", "Astral Gloves": "Rękawice Astralne",
  "Wrapped Mitts": "Owijki na Pięści", "Brawler Wraps": "Owijki Zabijaki", "Pit-fighter Wraps": "Owijki Zapaśnika",
  "Chapel Gauntlets": "Rękawice Kapliczne", "Oathsworn Gauntlets": "Rękawice Zaprzysiężonego", "Hallowed Gauntlets": "Rękawice Uświęcone",
  "Thief's Gloves": "Rękawice Złodzieja", "Mistweave Gloves": "Rękawice z Mglistej Przędzy", "Shadowsilk Gloves": "Rękawice z Cienistego Jedwabiu",
  // boots
  "Iron Sabatons": "Trzewiki Żelazne", "March Greaves": "Nagolenniki Marszowe", "Fleetstride Greaves": "Nagolenniki Chyżego Kroku", "Bastion Sabatons": "Trzewiki Bastionowe",
  "Mudwalker Boots": "Buty Błotne", "Tracker Boots": "Buty Tropiciela", "Shadowstep Boots": "Buty Cienistego Kroku", "Windrunner Boots": "Buty Wiatrobiegacza",
  "Cloth Slippers": "Pantofle Płócienne", "Acolyte Slippers": "Pantofle Akolity", "Silken Slippers": "Pantofle Jedwabne", "Starwalk Slippers": "Pantofle Gwiezdnej Ścieżki",
  "Legwrap Boots": "Buty z Onucami", "Raider Boots": "Buty Najeźdźcy", "Warlord Treads": "Buty Watażki",
  "Chapel Boots": "Buty Kapliczne", "Oathsworn Greaves": "Nagolenniki Zaprzysiężonego", "Hallowed Greaves": "Nagolenniki Uświęcone",
  "Pilgrim Boots": "Buty Pielgrzyma", "Mistwalk Boots": "Buty Mglistej Ścieżki", "Duskweave Boots": "Buty ze Zmierzchowej Przędzy",
  // jewellery
  "Knotted Cord": "Sznur z Supłami", "Bonecharm Pendant": "Wisior Kościany", "Amber Talisman": "Fetysz Bursztynowy", "Lapis Locket": "Medalion z Lapisu",
  "Greenstone Amulet": "Amulet z Zielonego Kamienia", "Obsidian Reliquary": "Relikwiarz Obsydianowy",
  "Tarnished Band": "Obrączka Zmatowiała", "Glimmer Loop": "Kółko Migotliwe", "Garnet Ring": "Pierścień z Granatem", "Palemoon Ring": "Pierścień Bladego Księżyca",
  "Thornsteel Ring": "Pierścień z Cierniowej Stali", "Sevenfold Band": "Obrączka Siedmiokrotna",
  "Cinderstone Ring": "Pierścień z Kamieniem Żaru", "Rimestone Ring": "Pierścień z Kamieniem Szronu", "Stormglass Ring": "Pierścień z Burzowego Szkła",
  "Blightstone Ring": "Pierścień z Kamieniem Zarazy", "Vergestone Band": "Obrączka z Kamienia Granicznego",
  "Palewater Pendant": "Wisior Bladej Wody", "Halo Torc": "Naszyjnik Aureoli", "Soulflame Amulet": "Amulet Płomienia Duszy",
  // belts
  "Rope Sash": "Przepaska ze Sznura", "Hide Belt": "Pas Skórzany", "Studded Girdle": "Pas Ćwiekowany", "Plated Girdle": "Pas Płytowy", "Chainlink Belt": "Pas Łańcuchowy",
  "Drover's Strap": "Rzemień Poganiacza", "Ironplate Cinch": "Popręg z Żelaznych Płyt",
  // flasks
  "Tin Draught": "Napitek Cynowy", "Pewter Draught": "Napitek Ołowiany", "Copper Draught": "Napitek Miedziany", "Bronze Draught": "Napitek Spiżowy",
  "Ironbound Draught": "Napitek Okuty Żelazem", "Silvered Draught": "Napitek Posrebrzany", "Gilt Draught": "Napitek Złocony",
  "Blackglass Draught": "Napitek z Czarnego Szkła", "Saintsblood Draught": "Napitek Krwi Świętych",
  "Inkwell Phial": "Fiolka Atramentowa", "Slate Phial": "Fiolka Łupkowa", "Cobalt Phial": "Fiolka Kobaltowa", "Indigo Phial": "Fiolka Indygo", "Azure Phial": "Fiolka Lazurowa",
  "Tidewater Phial": "Fiolka Wód Pływowych", "Nightwell Phial": "Fiolka Nocnej Studni", "Starwater Phial": "Fiolka Gwiezdnej Wody", "Aetherwell Phial": "Fiolka Eterycznego Źródła",
  // charms
  "Thawstone Charm": "Talizman Kamienia Odwilży", "Anchorweight Charm": "Talizman Kotwicznego Ciężaru", "Last-Breath Charm": "Talizman Ostatniego Tchu",
  "Harefoot Charm": "Talizman Zajęczej Łapki", "Bristleback Charm": "Talizman Najeżonego Grzbietu", "Mender's Knot Charm": "Talizman Węzła Uzdrowiciela",
  "Gilded Tooth Charm": "Talizman Złoconego Zęba", "Hearthcoal Charm": "Talizman Węgla z Paleniska", "Wet Ash Charm": "Talizman Mokrego Popiołu",
  "Lodestone Charm": "Talizman Magnetytu", "Clotroot Charm": "Talizman Korzenia Krzepnięcia", "Bitterleaf Charm": "Talizman Gorzkiego Liścia",
  "Bedrock Charm": "Talizman Skalnego Podłoża", "Emberglass Charm": "Talizman Żarzącego Szkła", "Rimeglass Charm": "Talizman Szronowego Szkła",
  "Stormglass Charm": "Talizman Burzowego Szkła", "Blightglass Charm": "Talizman Szkła Zarazy",
  // jewels
  "Bloodgarnet Jewel": "Klejnot Krwawego Granatu", "Mossglass Jewel": "Klejnot Mszystego Szkła", "Starsilt Jewel": "Klejnot Gwiezdnego Mułu",
  "Driftglass Jewel": "Klejnot Morskiego Szkła", "Stillstone Jewel": "Klejnot Cichego Kamienia",
};

/** Prefixes: masculine adjective (first word is inflected), or "~" + genitive phrase placed after the base. */
export const PREFIX_PL: Record<string, string> = {
  // life / mana / spirit / movement
  "Thick-Hided": "Gruboskóry", "Gristled": "Żylasty", "Ox-Blooded": "~Wolej Krwi", "Boar-Hearted": "~Dziczego Serca", "Mountainheart": "~Serca Góry",
  "Barrowborn": "Zrodzony z Kurhanu", "Cairn-Giant's": "~Olbrzyma z Kopca",
  "Lucid": "Światły", "Brimming-Minded": "~Pełnego Umysłu", "Inkwell": "~Kałamarza", "Wellspring": "~Krynicy", "Moonpooled": "~Księżycowej Toni", "Abyss-Drinking": "Pijący z Otchłani",
  "Kindred": "Pokrewny", "Soulbound": "~Związanej Duszy", "Hallowed": "Uświęcony", "Ossuary-Kept": "Strzeżony w Ossuarium", "Reliquary": "Relikwiarzowy",
  "Vigil-Keeper's": "~Strażnika Czuwania", "Wake-Singer's": "~Żałobnego Śpiewaka", "Ossuary-Warden's": "~Strażnika Ossuarium", "Reliquary-Choir": "~Chóru Relikwii",
  "Scurrying": "Czmychający", "Hare-Footed": "Zajęczonogi", "Windswept": "Wichrowy", "Ghost-Striding": "~Upiornego Kroku", "Stormheeled": "~Burzowych Pięt",
  // weapon damage
  "Jagged": "Poszarpany", "Hooked": "Haczykowaty", "Barbed": "Zadziorny", "Flensing": "Skórujący", "Gutting": "Patroszący", "Marrow-Splitting": "Łupiący Szpik",
  "Bonebreaker's": "~Łamignata",
  "Grim": "Ponury", "Baleful": "Złowrogi", "Ruinous": "Zgubny", "Gore-Slick": "Śliski od Posoki", "Butcher's": "~Rzeźnika", "Carrion-King's": "~Króla Padliny",
  "Hedge-Knight's": "~Błędnego Rycerza", "Freebooter's": "~Grasanta", "Warband's": "~Watahy", "Dread-Captain's": "~Kapitana Trwogi",
  "Whispering": "Szepczący", "Murmuring": "Mamroczący", "Hexing": "Przeklinający", "Thundervoiced": "Gromogłosy", "Abyssal": "Otchłanny", "Voidcalling": "Wzywający Pustkę",
  "Candlelit": "~Blasku Świec", "Grimoire-Bound": "~Grymuaru", "Lichlight": "~Światła Lisza", "Ninth-Bell": "~Dziewiątego Dzwonu",
  "Spurred": "Ostrogowy", "Thorned": "Ciernisty", "Spiked": "Kolczasty", "Rending": "Rozdzierający", "Skinflayer's": "~Oprawcy",
  "Fletched": "Opierzony", "Bodkin": "Szydłowy", "Broadhead": "Szerokogroty", "Heartseeker's": "~Szukającego Serc", "Skewering": "Przeszywający",
  "Level-Eyed": "~Pewnego Oka", "Marksman's": "~Strzelca", "Unblinking": "Niemrugający", "Crow's-Nest": "~Bocianiego Gniazda", "Far-Sighted": "Dalekowzroczny",
  "Gallows-Watch": "~Szubienicznej Warty",
  // flat defences
  "Riveted": "Nitowany", "Hobnailed": "Podkuty", "Bulwarked": "Obwarowany", "Iron-Banded": "Okuty Żelazem", "Ironclad": "Żelazny", "Siegewalled": "~Oblężonych Murów",
  "Lissom": "Gibki", "Wraithlike": "Widmowy", "Smokeborn": "Zrodzony z Dymu", "Mist-Stepping": "Stąpający we Mgle", "Duskwalker's": "~Wędrowca Zmierzchu", "Nightveiled": "Spowity Nocą",
  "Candlewarded": "Strzeżony Świecą", "Haloed": "~Aureoli", "Starwoven": "Utkany z Gwiazd", "Auroral": "Zorzowy", "Seraph-Spun": "~Serafickiej Przędzy", "Eclipse-Hung": "~Zaćmienia",
  "Brigand's": "~Zbója", "Skirmisher's": "~Harcownika", "Raider's": "~Najeźdźcy", "Raid-Chief's": "~Herszta Najeźdźców",
  "Chaplain's": "~Kapelana", "Penitent's": "~Pokutnika", "Inquisitor's": "~Inkwizytora", "Black Abbot's": "~Czarnego Opata",
  "Hedge-Witch's": "~Wiejskiej Wiedźmy", "Moth-Winged": "Ćmoskrzydły", "Fen-Spirit's": "~Ducha Mokradeł", "Will-o'-Wisp": "~Błędnego Ognika",
  // % defences
  "Hardened": "Hartowany", "Cold-Forged": "Kuty na Zimno", "Unbending": "Nieugięty", "Anvil-Hearted": "~Serca z Kowadła", "Unbreaking": "Niezłomny", "Doomforged": "Wykuty w Zgubie",
  "Shifting": "Zwodniczy", "Flickering": "Migotliwy", "Slipshadow": "~Umykającego Cienia", "Fogbound": "Spowity Mgłą", "Phantasmal": "Fantomowy", "Unseen": "Niewidzialny",
  "Shimmering": "Migoczący", "Lambent": "Jarzący", "Vesper-Lit": "~Wieczornego Blasku", "Moonwrought": "~Księżycowej Roboty", "Starfallen": "~Spadłej Gwiazdy", "Godspark": "~Boskiej Iskry",
  "Scrapper's": "~Zabijaki", "Bladesman's": "~Szermierza", "Bandit-Lord's": "~Herszta Bandytów", "Wolfmail": "~Wilczej Kolczugi", "Reaver-King's": "~Króla Łupieżców",
  "Blood-Oath": "~Przysięgi Krwi",
  "Votive": "Wotywny", "Censer-Hung": "~Kadzielnicy", "Sanctified": "Poświęcony", "Cathedral": "Katedralny", "Martyr's": "~Męczennika", "Saint-Forged": "~Kuźni Świętych",
  "Thistledown": "~Ostowego Puchu", "Gloaming": "Zmierzchowy", "Veil-Woven": "Utkany z Woalu", "Sable": "Sobolowy", "Twilit": "Półmroczny", "Starless": "Bezgwiezdny",
  // % defence hybrids
  "Ox-Yoked": "~Wolego Jarzma", "Bull-Necked": "Byczokarki", "Aurochs-Hide": "~Turzej Skóry", "Titan-Ribbed": "~Żeber Tytana",
  "Squire's": "~Giermka", "Chanter-Knight's": "~Rycerza Kantora", "Rune-Helmed": "~Runicznego Hełmu", "Oracle-Guard's": "~Strażnika Wyroczni",
  "Stockade": "~Częstokołu", "Palisade": "~Palisady", "Rampart-Built": "~Wałów Obronnych", "Keepwalled": "~Murów Stołpu",
  "Fox-Blooded": "~Lisiej Krwi", "Lynx-Blooded": "~Rysiej Krwi", "Panther-Blooded": "~Krwi Pantery", "Night-Hunter's": "~Nocnego Łowcy",
  "Dreaming": "Śniący", "Owl-Eyed": "Sowiooki", "Dusk-Reader's": "~Czytającego Zmierzch", "Far-Dreamer's": "~Dalekiego Śniącego",
  "Surefoot": "~Pewnej Stopy", "Goat-Stepping": "~Koziego Kroku", "Ledge-Walker's": "~Chodzącego po Gzymsach", "Unfalling": "Nieupadły",
  "Hearth-Warded": "~Straży Paleniska", "Blood-Sigiled": "~Krwawej Pieczęci", "Lifebound": "Związany z Życiem", "Heart-of-Glass": "~Szklanego Serca",
  "Acolyte's": "~Akolity", "Scrivener's": "~Skryby", "Archivist's": "~Archiwisty", "Thought-Eater's": "~Pożeracza Myśli",
  "Poised": "Opanowany", "Stillwater": "~Cichej Wody", "Unruffled": "Niewzruszony", "Calm-Eyed": "~Spokojnego Spojrzenia",
  "Drifter's": "~Włóczęgi", "Outrider's": "~Zwiadowcy", "Marauder's": "~Grabieżcy", "Wolf-Captain's": "~Wilczego Kapitana",
  "Hedge-Captain's": "~Kapitana z Gościńca", "Cunning": "Przebiegły", "War-Seer's": "~Wojennego Wieszcza", "Raven-Marshal's": "~Kruczego Marszałka",
  "Footpad's": "~Rzezimieszka", "Sellsword's": "~Najemnika", "Free-Captain's": "~Wolnego Kapitana", "Pale Company": "~Bladej Kompanii",
  "Pilgrim's": "~Pielgrzyma", "Almoner's": "~Jałmużnika", "Hospitaller's": "~Szpitalnika", "Relic-Bearer's": "~Niosącego Relikwie",
  "Cantor's": "~Kantora", "Lector's": "~Lektora", "Psalm-Bound": "~Psalmu", "High Cantor's": "~Wielkiego Kantora",
  "Novice's": "~Nowicjusza", "Oath-Sworn": "Zaprzysiężony", "Reliquary-Guard": "~Straży Relikwiarza", "Last Bastion": "~Ostatniego Bastionu",
  "Marsh-Walker's": "~Wędrowca Bagien", "Crow-Mother's": "~Wroniej Matki", "Bog-Seer's": "~Wieszcza z Trzęsawisk", "Wychwood": "~Wiedźmiego Lasu",
  "Moth-Minded": "~Ćmich Myśli", "Dew-Reader's": "~Czytającego Rosę", "Mist-Seer's": "~Wieszcza Mgieł", "Moon-Hollow": "~Księżycowej Kotliny",
  "Reed-Walker's": "~Wędrowca Trzcin", "Heron-Stepping": "~Czaplego Kroku", "Mire-Dancer's": "~Tancerza Grzęzawisk", "Fen-Ghost's": "~Upiora Mokradeł",
  // flat + % defences (body), global defences
  "Banded": "Obręczowy", "Double-Riveted": "~Podwójnych Nitów", "Thrice-Forged": "~Trzykrotnego Kucia", "Gatehouse": "~Bramnej Baszty",
  "Soft-Footed": "Cichostopy", "Quicksilver": "Rtęciowy", "Windblown": "Rozwiany", "Vanishing": "Znikający",
  "Glimmering": "Połyskliwy", "Halo-Bound": "~Kręgu Aureoli", "Dawn-Woven": "Utkany ze Świtu", "Sun-Crowned": "~Słonecznej Korony",
  "Leathered": "Skórzany", "Scaled": "Łuskowy", "Horn-Plated": "Rogowy", "Anvil-Struck": "Kuty na Kowadle",
  "Lithe": "Zwinny", "Mistcloaked": "Okryty Mgłą", "Shadow-Slipping": "~Cienistego Uskoku", "Nightjar's": "~Lelka",
  "Wardlit": "~Ochronnego Blasku", "Glyph-Etched": "~Rytych Glifów", "Sigil-Bright": "~Jasnej Pieczęci", "Crowned in Stars": "~Gwiezdnej Korony",
  "Ironsouled": "~Żelaznej Duszy", "Oak-Ribbed": "~Dębowych Żeber", "Bastioned": "Bastionowy",
  "Quickblooded": "~Wartkiej Krwi", "Feline": "Koci", "Shade-Kissed": "~Pocałunku Cienia",
  "Pious": "Pobożny", "Rapt": "Natchniony", "Transfigured": "Przemieniony",
  "Sipping": "Popijający", "Deep-Gulping": "~Głębokiego Haustu", "Tippler's": "~Opoja", "Wake-Feasting": "~Stypy",
  "Parrying": "Parujący", "Turning": "Odbijający", "Unbreached": "Niezdobyty",
  "Magpie's": "~Sroki", "Grave-Robber's": "~Hieny Cmentarnej", "Hoarder's": "~Ciułacza",
  // flasks
  "Potent": "Mocny", "Brimming": "Wezbrany", "Overflowing": "Przelewający się", "Snapcork": "~Strzelającego Korka", "Hissing": "Syczący", "Boiling": "Wrzący",
  "Scalding": "Parzący", "Quickened": "Przyspieszony", "Hastened": "Ponaglony", "Torrential": "Ulewny", "Desperate": "Rozpaczliwy",
  // charms
  "Lingering": "Trwały", "Abiding": "Wytrwały", "Undying": "Nieśmiertelny", "Frugal": "Oszczędny", "Sparing": "Wstrzemięźliwy", "Miserly": "Skąpy",
  "Mending": "Gojący", "Suturing": "Zszywający", "Restoring": "Odnawiający", "Musing": "Zadumany", "Pondering": "Rozmyślający",
  // jewels
  "Hearty": "Krzepki", "Thick-Veined": "~Grubych Żył", "Spiteful": "Zawistny", "Feral": "Dziki", "Notched": "Wyszczerbiony", "Sawtoothed": "Piłozębny",
  "Chorused": "Chóralny", "Leeching": "Wysysający", "Gorging": "Żarłoczny", "Iron-Skinned": "~Żelaznej Skóry", "Unyielding": "Nieustępliwy",
  "Shoving": "Popychający", "Battering": "Taranujący", "Hazed": "Zamglony", "Keen": "Bystry", "Hawk-eyed": "Sokolooki", "Lunging": "~Długiego Wypadu",
  "Far-reaching": "Dalekosiężny", "Lustrous": "Lśniący", "Radiant": "Promienny", "Swelling": "Wzbierający", "Surging": "Spiętrzony",
  "Spiteful Tide": "~Zawistnego Przypływu", "Feral Tide": "~Dzikiego Przypływu", "Murmuring Tide": "~Szemrzącego Przypływu", "Chorused Tide": "~Chóralnego Przypływu",
  "Silted": "Zamulony", "Bedded": "Osadzony", "Misting": "Mglisty", "Whetstone-Lit": "~Blasku Osełki", "Lanternbright": "~Jasności Latarni",
};

/** Suffixes ("of the X"): a genitive phrase that follows the base. */
export const SUFFIX_PL: Record<string, string> = {
  "of Twitching": "Drgawek", "of Flurries": "Nawałnicy", "of the Hummingbird": "Kolibra", "of the Hornet": "Szerszenia", "of the Locust Swarm": "Roju Szarańczy",
  "of Splinters": "Drzazg", "of the Fang": "Kła", "of the Bone Needle": "Kościanej Igły", "of the Fault Line": "Uskoku",
  "of Restless Hands": "Niespokojnych Rąk", "of Quick Knuckles": "Szybkich Pięści", "of the Mantis": "Modliszki",
  "of Long Arms": "Długich Ramion", "of the Heron": "Czapli", "of Far Grasp": "Dalekiego Chwytu", "of the Gibbet Pole": "Szubienicznego Słupa",
  "of Shoving": "Popychania", "of the Battering Ram": "Tarana", "of the Avalanche": "Lawiny",
  "of the Lantern-Eye": "Latarnianego Oka", "of the Night Watch": "Nocnej Straży", "of the Torchbearer": "Niosącego Pochodnię",
  "of Keen Eyes": "Bystrych Oczu", "of the Keen Edge": "Ostrej Krawędzi", "of Glass Shards": "Szklanych Odłamków", "of the Split Hair": "Rozszczepionego Włosa",
  "of the Last Breath": "Ostatniego Tchnienia",
  "of Cruel Intent": "Okrutnych Zamiarów", "of the Severing": "Odcięcia", "of the Headsman": "Kata", "of the Gallows": "Szubienicy",
  "of Quick Tongues": "Szybkich Języków", "of the Hasty Rite": "Pospiesznego Obrzędu", "of the Racing Pulse": "Przyspieszonego Tętna",
  "of the Ninefold Chant": "Dziewięciokrotnej Inkantacji",
  "of Trickling Thought": "Sączącej się Myśli", "of the Spring": "Źródła", "of the Undertow": "Głębinowego Prądu", "of the Cistern": "Cysterny",
  "of the Drowned Choir": "Utopionego Chóru",
  "of the Hauler": "Tragarza", "of the Quarryman": "Kamieniarza", "of the Smith": "Kowala", "of the Barrow-Bear": "Kurhanowego Niedźwiedzia",
  "of the Iron Giant": "Żelaznego Olbrzyma", "of the Mountain King": "Króla Gór",
  "of the Stoat": "Gronostaja", "of the Pickpocket": "Kieszonkowca", "of the Cutpurse": "Rzezimieszka", "of the Knife-Dancer": "Tancerza Noży",
  "of the Nightcat": "Nocnego Kota", "of the Shadowpaw": "Cienistej Łapy",
  "of the Novice": "Nowicjusza", "of the Scribe": "Skryby", "of the Lamplighter": "Latarnika", "of the Bone Scholar": "Kościanego Uczonego",
  "of the Black Library": "Czarnej Biblioteki", "of the Starless Mind": "Bezgwiezdnego Umysłu",
  "of the Ash Tree": "Jesionu", "of Old Bones": "Starych Kości", "of the Pale Throne": "Bladego Tronu",
  "of the Hearth": "Paleniska", "of Cinderproof": "Żaroodporności", "of the Charred Hide": "Zwęglonej Skóry", "of the Pyre-Walker": "Kroczącego po Stosie",
  "of the Coalwarden": "Strażnika Węgli", "of the Ashen Saint": "Popielnego Świętego",
  "of the Fur": "Futra", "of Rimeproof": "Szronoodporności", "of the Wolfpelt": "Wilczej Skóry", "of the Glacier": "Lodowca", "of the Long Night": "Długiej Nocy",
  "of the Frostbitten Saint": "Odmrożonego Świętego",
  "of Grounding": "Uziemienia", "of the Lodestone": "Magnetytu", "of the Copper Rod": "Miedzianego Pręta", "of the Stormwall": "Burzowego Muru",
  "of the Lightning-Eater": "Pożeracza Piorunów", "of the Skyward Spire": "Niebosiężnej Iglicy",
  "of Clean Blood": "Czystej Krwi", "of the Antidote": "Odtrutki", "of the Plague Doctor": "Doktora Zarazy", "of the Leech-Eater": "Zjadacza Pijawek",
  "of the Rotless": "Nietkniętego Zgnilizną",
  "of the Spectrum": "Widma Barw", "of Mother-of-Pearl": "Masy Perłowej", "of the Bright Shell": "Jasnej Muszli",
  "of Mending": "Gojenia", "of Moss": "Mchu", "of Stitchwort": "Gwiazdnicy", "of the Old Oak": "Starego Dębu", "of the Rootheart": "Serca Korzeni",
  "of the Undying Elm": "Nieśmiertelnego Wiązu",
  "of Brimming": "Obfitości", "of the Deep Well": "Głębokiej Studni", "of the Cask": "Beczki", "of the Bottomless Jug": "Dzbana bez Dna",
  "of Quick Wards": "Szybkich Osłon", "of the Ready Veil": "Gotowej Zasłony", "of the Unbroken Vigil": "Nieprzerwanego Czuwania",
  "of Footing": "Pewnego Gruntu", "of the Anchor": "Kotwicy", "of the Millstone": "Kamienia Młyńskiego", "of the Standing Stone": "Menhiru",
  "of Hardy Blood": "Krzepkiej Krwi", "of the Unflinching": "Niewzruszonego", "of the Iron Gut": "Żelaznego Żołądka",
  "of Tumbling": "Koziołków", "of the Eel": "Węgorza", "of the Weasel": "Łasicy", "of the Smoke-Dancer": "Tancerza Dymu",
  "of the Hedge-Witch": "Wiejskiej Wiedźmy", "of the Black Coven": "Czarnego Sabatu", "of the Tinderbox": "Krzesiwa", "of the Burning Pyre": "Płonącego Stosu",
  "of the Witch-Fire": "Wiedźmiego Ognia", "of the Hoarfrost": "Szadzi", "of the Frozen Mere": "Zamarzniętego Jeziora", "of the Deathless Winter": "Wiecznej Zimy",
  "of the Crackle": "Trzasku Iskier", "of the Struck Bell": "Uderzonego Dzwonu", "of the Splitting Sky": "Pękającego Nieba",
  "of the Pit-Fighter": "Zapaśnika z Areny", "of the Bloody Sands": "Krwawych Piasków", "of the Fletcher": "Łuczarza", "of the Hollow Shaft": "Pustego Drzewca",
  "of the Tempered Rim": "Hartowanego Obrzeża", "of the Storm-Proof Wall": "Muru Odpornego na Burze",
  "of the Magpie": "Sroki", "of the Grave-Robber": "Hieny Cmentarnej", "of the Hoard": "Skarbca",
  // flasks
  "of the Wellspring": "Krynicy", "of Thirst": "Pragnienia", "of Craving": "Łaknienia", "of Gluttony": "Obżarstwa", "of Thrift": "Oszczędności",
  "of Scrimping": "Skąpienia", "of the Miser": "Sknery", "of Sparing": "Umiaru", "of Hoarding": "Gromadzenia", "of Clotting": "Krzepnięcia",
  "of Quenching": "Gaszenia", "of Steadying": "Opanowania",
  // charms
  "of Hunger": "Głodu", "of Famine": "Wielkiego Głodu", "of the Glutton": "Żarłoka", "of Depth": "Głębi", "of the Abyss": "Otchłani",
  // jewels
  "of Pacing": "Miarowego Kroku", "of the Courier": "Gońca", "of Fidgeting": "Niecierpliwości", "of Haste": "Pośpiechu", "of Ducking": "Uchylania",
  "of Sidesteps": "Uskoków", "of Seeping": "Sączenia", "of Rills": "Strumyków", "of the Chase": "Pościgu", "of the Hunt": "Łowów", "of Trinkets": "Błyskotek",
  "of Baubles": "Świecidełek", "of Knitting": "Zrastania", "of Stitching": "Zszywania", "of the Oak": "Dębu", "of the Mountain": "Góry",
  "of Rekindling": "Rozniecenia", "of the Pyre Ash": "Popiołu ze Stosu", "of the Thornprick": "Ukłucia Ciernia", "of the Awl": "Szydła", "of Wreckage": "Zniszczenia",
  "of Wounding": "Ranienia", "of Butchery": "Rzezi", "of Fortitude": "Hartu", "of Constancy": "Stałości", "of the Tippler": "Opoja", "of the Sot": "Pijaka",
  "of Refilling": "Dolewki", "of Drift": "Dryfu", "of Ripples": "Zmarszczek Wody", "of Rapids": "Bystrzyn", "of Eddies": "Wirów", "of Whirlpools": "Odmętów",
  "of Shoals": "Mielizn", "of Reefs": "Raf", "of Seepage": "Przesiąkania", "of Springs": "Źródeł",
};

/** Rare names: first word as a genitive noun, second as the head noun. */
const RARE_A: Record<string, string> = {
  Ember: "Żaru", Gloom: "Mroku", Bitter: "Goryczy", Hollow: "Pustki", Storm: "Burzy", Rust: "Rdzy", Dread: "Trwogi", Ashen: "Popiołu", Pale: "Bladości",
  Thorn: "Ciernia", Grave: "Grobu", Brine: "Solanki",
};
const RARE_B: Record<string, string> = {
  Bite: "Ukąszenie", Whisper: "Szept", Mark: "Znamię", Ward: "Straż", Coil: "Splot", Vow: "Przysięga", Song: "Pieśń", Shroud: "Całun", Grip: "Uścisk",
  Lament: "Lament", Spur: "Ostroga", Knell: "Podzwonne",
};

function splitBase(v: string): [string, G] {
  const i = v.indexOf("|");
  if (i >= 0) return [v.slice(0, i), v.slice(i + 1) as G];
  return [v, HEAD[v.split(" ")[0]] ?? "m"];
}

/** Masculine adjective -> the form for gender g (regular -y / -i adjectives and participles). */
export function inflect(adj: string, g: G): string {
  if (g === "m") return adj;
  const sp = adj.indexOf(" ");
  const w = sp < 0 ? adj : adj.slice(0, sp);
  const rest = sp < 0 ? "" : adj.slice(sp);
  const stem = w.slice(0, -1);
  let out = w;
  if (w.endsWith("y")) out = stem + (g === "f" ? "a" : "e");
  else if (w.endsWith("i")) {
    const hard = /[kg]$/.test(stem);
    out = stem + (g === "f" ? (hard ? "a" : "ia") : "ie");
  }
  return out + rest;
}

const BASES_BY_LEN = Object.keys(BASE_PL).sort((a, b) => b.length - a.length);

/**
 * Polish form of a composed item name, or null when `s` is not one. `lookup` translates a part
 * through the main dictionary (used for names that carry a tier numeral, e.g. "Heavy Hand II").
 */
export function composeName(s: string, lookup: (s: string) => string | null): string | null {
  const exactBase = BASE_PL[s];
  if (exactBase) return splitBase(exactBase)[0];
  if (PREFIX_PL[s]) return PREFIX_PL[s].replace(/^~/, "");
  if (SUFFIX_PL[s]) return SUFFIX_PL[s];
  const roman = /^(.+) (I|II|III|IV|V)$/.exec(s);
  if (roman) {
    const head = lookup(roman[1]);
    return head === null ? null : `${head} ${roman[2]}`;
  }
  const two = /^([A-Z][a-z]+) ([A-Z][a-z]+)$/.exec(s);
  if (two && RARE_A[two[1]] && RARE_B[two[2]]) return `${RARE_B[two[2]]} ${RARE_A[two[1]]}`;
  if (!s.includes(" ")) return null;
  for (const b of BASES_BY_LEN) {
    const i = s.indexOf(b);
    if (i < 0) continue;
    const end = i + b.length;
    if ((i > 0 && s[i - 1] !== " ") || (end < s.length && s[end] !== " ")) continue;
    const pre = s.slice(0, i).trim();
    const suf = s.slice(end).trim();
    if (!pre && !suf) continue;
    const p = pre ? PREFIX_PL[pre] : "";
    const x = suf ? SUFFIX_PL[suf] : "";
    if ((pre && !p) || (suf && !x)) continue;
    const [name, g] = splitBase(BASE_PL[b]);
    const after: string[] = [];
    let front = "";
    if (p) {
      if (p.startsWith("~")) after.push(p.slice(1));
      else front = inflect(p, g) + " ";
    }
    if (x) after.push(x);
    return front + name + (after.length ? " " + after.join(" i ") : "");
  }
  return null;
}
