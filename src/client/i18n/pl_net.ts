// Polish: online rooms (room browser, create / join by code, connecting to the host: src/net/p2p.ts).
import type { Dict } from "./index";

export const PL_NET: Dict = {
  "Play · Find a room": "Graj · Znajdź pokój", "Create room": "Utwórz pokój", Rooms: "Pokoje", "or join by code": "albo dołącz kodem", CODE: "KOD",
  "Type the 5-character room code first.": "Najpierw wpisz 5-znakowy kod pokoju.", "Open rooms": "Otwarte pokoje", Code: "Kod", LAN: "LAN",
  "Rooms are found through public relays (and your local network in the desktop app); nobody runs a server. The host's machine runs the match.":
    "Pokoje są wyszukiwane przez publiczne przekaźniki (a w aplikacji także w sieci lokalnej); nikt nie uruchamia serwera. Mecz działa na komputerze hosta.",
  "No open rooms right now. Create one and share the code.": "Nie ma teraz otwartych pokoi. Utwórz własny i podaj znajomym kod.",
  "Looking for rooms…": "Szukanie pokoi…", "Joining room {$c}…": "Dołączanie do pokoju {c}…",
  "Room {$c} is open and listed in the room browser. Share the code; waiting for players…": "Pokój {c} jest otwarty i widoczny na liście pokoi. Podaj znajomym kod; czekanie na graczy…",
  "Room code": "Kod pokoju", Copy: "Kopiuj", "Waiting for the host to start…": "Czekanie, aż host rozpocznie…",
  "Looking for the host…": "Szukanie hosta…", "Connecting to the host…": "Łączenie z hostem…",
  "Online rooms are unavailable here: {$x}": "Pokoje online są tu niedostępne: {x}",
  "No host answered for room {$c}. Check the code; if it is right, your network or the host's may block direct connections.":
    "Żaden host nie odpowiedział w pokoju {c}. Sprawdź kod; jeśli jest dobry, twoja sieć lub sieć hosta może blokować bezpośrednie połączenia.",
  "Could not open a connection to the host ({$x}).": "Nie udało się otworzyć połączenia z hostem ({x}).",
  "The host closed the connection.": "Host zamknął połączenie.",
  "The host was found but the connection did not open. One of you may be behind a strict network (no TURN relay).":
    "Host został znaleziony, ale połączenie się nie otworzyło. Któreś z was może być za restrykcyjną siecią (brak przekaźnika TURN).",
  "The host left the room.": "Host opuścił pokój.",
  "The local network relay stopped: players on your network join over the internet relays instead.":
    "Przekaźnik sieci lokalnej przestał działać: gracze z twojej sieci dołączą przez przekaźniki internetowe.",
};
