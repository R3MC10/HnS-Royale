// Player-facing patch notes, newest first. Shown by the main menu's patch notes popup
// (src/client/menus/patchnotes.ts): once per new client version, and from the "Patch notes" button.
// Keep lines short and in player language (no file names or internals). Every line carries its
// Polish text next to the English one.

export interface NoteLine {
  en: string;
  pl: string;
}

export interface ChangelogEntry {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  new?: NoteLine[];
  changes?: NoteLine[];
  fixes?: NoteLine[];
}

const L = (en: string, pl: string): NoteLine => ({ en, pl });

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.4",
    date: "2026-11-11",
    new: [
      L("Join a running match during its first 3 minutes. If it is full, you take a bot's place.", "Dołącz do trwającego meczu w ciągu pierwszych 3 minut. Gdy jest pełny, zajmujesz miejsce bota."),
      L("Refresh button in the room list.", "Przycisk Odśwież na liście pokoi."),
      L("Breachway shop: Ctrl+click items in your inventory to sell them, worn gear included.", "Sklep w Wyłomie: Ctrl+klik na przedmiocie w ekwipunku sprzedaje go, także założony."),
      L("Patch notes: this window shows what changed after each update. Reopen it any time from the main menu.", "Lista zmian: to okno pokazuje, co się zmieniło po każdej aktualizacji. Otworzysz je w każdej chwili z menu głównego."),
      L("Every class now starts with its own skill, including two new ones: Opening Cut (Gutterblade) and Hazeward Sweep (Mistrunner).", "Każda klasa zaczyna teraz z własną umiejętnością, w tym dwiema nowymi: Cięcie Otwierające (Nożownik) i Zamach Mgielnej Straży (Mgłobiegacz)."),
      L("Class traits: every class has a small innate bonus of its own, shown in the class showcase and the character panel.", "Cechy klas: każda klasa ma własny, niewielki wrodzony bonus, widoczny w prezentacji klas i w panelu postaci.")],
    changes: [
      L("The game now records short hitches and freezes so they can be tracked down and fixed.", "Gra zapisuje teraz krótkie przycięcia i zawieszenia, żeby dało się je wyśledzić i naprawić."),
      L("Breachway towers and other structures have an energy shield (a quarter of their life) that takes hits first and recharges after 4 seconds without damage.", "Wieże i inne budowle w Wyłomie mają tarczę energetyczną (jedna czwarta ich życia), która przyjmuje ciosy jako pierwsza i odnawia się po 4 sekundach bez obrażeń."),
      L("Life bars show sides: allies green, enemies red, neutral jungle monsters yellow.", "Paski życia pokazują strony: sojusznicy na zielono, wrogowie na czerwono, neutralne potwory z dżungli na żółto."),
      L("The passive tree is colour-coded by class: each region glows in its class colour, with your own region brightest.", "Drzewko pasywne ma kolory klas: każdy region świeci barwą swojej klasy, a twój najjaśniej.")],
    fixes: [L("Fixed a freeze of about a quarter second at the first big hit of a match.", "Naprawiono zawieszenie gry na około ćwierć sekundy przy pierwszym mocnym trafieniu w meczu."), L("Hosting is smoother: guest traffic is sent in batches, and players on your local network no longer wait on the host's screen.", "Hostowanie działa płynniej: ruch od gości jest wysyłany paczkami, a gracze z twojej sieci lokalnej nie czekają już na ekran hosta."), L("Fewer small stutters while messages are showing.", "Mniej drobnych przycięć, gdy wyświetlane są komunikaty."), L("Fixed a rare server crash from splash damage bouncing between players.", "Naprawiono rzadki błąd serwera, gdy obrażenia obszarowe odbijały się między graczami.")],
  },
  {
    version: "0.2.3",
    date: "2026-11-11",
    new: [
      L("Skills panel with support sockets, recommended links and gem upgrades.", "Panel umiejętności z gniazdami wsparcia, zalecanymi połączeniami i ulepszaniem klejnotów."),
      L("Rebuilt hall and character select: class showcase with stats, starting gear and ascendancies.", "Nowa sala i wybór postaci: prezentacja klas ze statystykami, startowym ekwipunkiem i wyniesieniami."),
      L("Breachway: Enhance and Reinforcements shop tabs, a forge, waypoints at structures, jungle camps and a bigger map.", "Wyłom: zakładki sklepu Ulepszanie i Posiłki, kuźnia, punkty podróży przy budowlach, obozy w dżungli i większa mapa."),
    ],
    changes: [
      L("New framed panels with one consistent look.", "Nowe obramowane panele o jednolitym wyglądzie."),
      L("Some skills are now bound to your weapon type.", "Niektóre umiejętności są teraz powiązane z rodzajem broni."),
      L("Evasion now works against all hits.", "Unik działa teraz przeciw wszystkim trafieniom."),
      L("Breachway: turret range and target marker, collapse animation, reworked trials, gold popups.", "Wyłom: zasięg wieżyczek i znacznik celu, animacja zawalenia, przerobione próby, wyskakujące złoto."),
      L("The desktop app prefers your high-performance graphics card.", "Aplikacja na komputer wybiera wydajniejszą kartę graficzną."),
    ],
    fixes: [
      L("The picture no longer freezes for good after a drawing error.", "Obraz nie zawiesza się już na stałe po błędzie rysowania."),
      L("Currency items now work on equipped gems.", "Waluta działa teraz na założonych klejnotach."),
    ],
  },
  {
    version: "0.2.2",
    date: "2026-11-11",
    new: [
      L("Auto-equip option for better gear you pick up.", "Opcja automatycznego zakładania lepszego podniesionego ekwipunku."),
      L("Options in the hall, and Quit game in the desktop app.", "Opcje w sali oraz Wyjdź z gry w aplikacji na komputer."),
      L("Your hero flashes when hit.", "Bohater błyska, gdy otrzyma trafienie."),
    ],
    changes: [
      L("Ranged attacks and projectiles fire toward the cursor; hovering an enemy aims at it.", "Ataki dystansowe i pociski lecą w stronę kursora; najechanie na wroga celuje w niego."),
      L("Smoother camera.", "Płynniejsza kamera."),
      L("Bots act on their own, stop ganging up on one player and are easier.", "Boty działają samodzielnie, nie rzucają się wszystkie na jednego gracza i są łatwiejsze."),
      L("Classes, ascendancies and the passive tree rebalanced.", "Przebalansowane klasy, wyniesienia i drzewko pasywne."),
      L("Damage numbers are on by default; dodge cooldown is 2.2 seconds.", "Liczby obrażeń są domyślnie włączone; odnowienie uniku trwa 2,2 sekundy."),
      L("Breachway: shorter matches, momentum waves and a siege ramp-up.", "Wyłom: krótsze mecze, fale rozpędu i narastające oblężenie."),
      L("Currency works on gems on the skill bar; Breachway skills target enemies only.", "Waluta działa na klejnotach na pasku umiejętności; w Wyłomie umiejętności celują tylko we wrogów."),
    ],
    fixes: [
      L("Hit pauses no longer freeze the picture, except on rare kills.", "Pauzy przy trafieniu nie zamrażają już obrazu, poza rzadkimi zabójstwami."),
      L("Less stutter while the map loads around you.", "Mniej przycięć podczas wczytywania mapy wokół ciebie."),
    ],
  },
  {
    version: "0.2.1",
    date: "2026-11-11",
    changes: [
      L("The launcher updates to the newest version before the game starts, with a progress bar. Offline, the game starts as is.", "Program startowy przed uruchomieniem gry aktualizuje ją do najnowszej wersji, z paskiem postępu. Bez internetu gra startuje bez zmian."),
    ],
  },
  {
    version: "0.2.0",
    date: "2026-11-11",
    new: [
      L("Breachway: a 5v5 lane mode with waves, spires, Wards, a Core, respawns and a shop. Pick it in the room's Mode setting.", "Wyłom: tryb 5v5 na liniach z falami, iglicami, Strażnicami, Rdzeniem, odradzaniem i sklepem. Wybierz go w ustawieniu Tryb pokoju."),
      L("Play PC to PC: the host's computer runs the match, open games are listed in the lobby, and rooms have codes.", "Gra z komputera na komputer: mecz działa u hosta, otwarte gry widać w lobby, a pokoje mają kody."),
      L("New music for the menu, exploring, combat, bosses and Breachway.", "Nowa muzyka w menu, podczas eksploracji, walki, bossów i w Wyłomie."),
    ],
    changes: [L("Version number on menu screens and glowing menu embers.", "Numer wersji na ekranach menu i żarzące się iskry w menu.")],
  },
  {
    version: "0.1.4",
    date: "2026-11-11",
    changes: [L("Inventory and character panels are larger, a third of the screen each.", "Panele ekwipunku i postaci są większe, każdy zajmuje jedną trzecią ekranu.")],
  },
  {
    version: "0.1.3",
    date: "2026-11-11",
    fixes: [L("Game graphics were missing from the installed game.", "W zainstalowanej grze brakowało grafiki.")],
  },
  {
    version: "0.1.2",
    date: "2026-11-11",
    fixes: [L("The installer is attached to every release again.", "Instalator znów jest dołączony do każdego wydania.")],
  },
  {
    version: "0.1.1",
    date: "2026-11-11",
    new: [L("The installer lets you pick the install folder, in English or Polish.", "Instalator pozwala wybrać folder instalacji, po angielsku lub po polsku.")],
  },
  {
    version: "0.1.0",
    date: "2026-11-11",
    new: [L("First release: the game, a Windows installer and automatic updates.", "Pierwsze wydanie: gra, instalator dla Windows i automatyczne aktualizacje.")],
  },
];

const DAY_MS = 86_400_000;

/** Entries dated within `days` before the newest entry, newest first. */
export function recentEntries(days = 7): ChangelogEntry[] {
  const at = (e: ChangelogEntry) => Date.parse(e.date + "T00:00:00Z");
  const sorted = [...CHANGELOG].sort((a, b) => at(b) - at(a) || cmpVersion(b.version, a.version));
  if (!sorted.length) return [];
  const cut = at(sorted[0]) - days * DAY_MS;
  return sorted.filter((e) => at(e) >= cut);
}

function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
