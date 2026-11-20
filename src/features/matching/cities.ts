/**
 * Israeli cities and towns with approximate centre coordinates, for "is this request near the volunteer?".
 *
 * City is free text in both forms (Hebrew or English, any spelling), so each entry lists its Hebrew name, English
 * name and common variants. Coordinates are approximate town centres (within ~1–2 km), which is plenty for
 * distance buckets of 15 / 30 km. A city that isn't listed simply gets no distance: it can still match by exact name.
 *
 * To add a town: append [hebrew, english, lat, lon, ...aliases].
 */
type Entry = [he: string, en: string, lat: number, lon: number, ...aliases: string[]];

const CITIES: Entry[] = [
  ["ירושלים", "Jerusalem", 31.7683, 35.2137, "Yerushalayim", "Al-Quds"],
  ["תל אביב-יפו", "Tel Aviv-Yafo", 32.0853, 34.7818, "תל אביב", "יפו", "Tel Aviv", "Tel-Aviv", "Jaffa", "Yafo", "TLV", "ת״א"],
  ["חיפה", "Haifa", 32.794, 34.9896, "Hefa"],
  ["ראשון לציון", "Rishon LeZion", 31.973, 34.7925, "Rishon Lezion", "Rishon Letzion", "Rishon", "ראשל״צ"],
  ["פתח תקווה", "Petah Tikva", 32.084, 34.8878, "פתח תקוה", "Petach Tikva", "Petah Tiqva", "פ״ת"],
  ["אשדוד", "Ashdod", 31.8014, 34.6435],
  ["נתניה", "Netanya", 32.3215, 34.8532, "Natanya"],
  ["באר שבע", "Beer Sheva", 31.2518, 34.7913, "Be'er Sheva", "Beersheba", "Beer Sheba", "ב״ש"],
  ["בני ברק", "Bnei Brak", 32.0807, 34.8338, "Bne Brak"],
  ["חולון", "Holon", 32.0158, 34.7874],
  ["רמת גן", "Ramat Gan", 32.0684, 34.8248],
  ["רחובות", "Rehovot", 31.8928, 34.8113, "Rechovot"],
  ["אשקלון", "Ashkelon", 31.6688, 34.5743],
  ["בת ים", "Bat Yam", 32.0171, 34.7454],
  ["בית שמש", "Beit Shemesh", 31.747, 34.9881, "Bet Shemesh"],
  ["כפר סבא", "Kfar Saba", 32.175, 34.907, "Kefar Sava", "Kfar Sava"],
  ["הרצליה", "Herzliya", 32.1624, 34.8447, "Herzliyya", "Hertzliya"],
  ["חדרה", "Hadera", 32.434, 34.9196],
  ["מודיעין-מכבים-רעות", "Modiin", 31.898, 35.0104, "מודיעין", "Modi'in", "Modiin-Maccabim-Reut", "Maccabim", "Reut"],
  ["לוד", "Lod", 31.951, 34.8881, "Lydda"],
  ["רמלה", "Ramla", 31.9293, 34.8664, "Ramle"],
  ["נצרת", "Nazareth", 32.6996, 35.3035, "Natzrat", "Al-Nasira"],
  ["רעננה", "Raanana", 32.1848, 34.8713, "Ra'anana"],
  ["ראש העין", "Rosh HaAyin", 32.0956, 34.9566, "Rosh Haayin", "Rosh Ha'ayin"],
  ["הוד השרון", "Hod HaSharon", 32.15, 34.888, "Hod Hasharon"],
  ["גבעתיים", "Givatayim", 32.0722, 34.8125, "Giv'atayim"],
  ["קריית גת", "Kiryat Gat", 31.61, 34.7642, "קרית גת"],
  ["נהריה", "Nahariya", 33.0059, 35.0947, "Nahariyya"],
  ["עפולה", "Afula", 32.6078, 35.2897],
  ["קריית אתא", "Kiryat Ata", 32.8115, 35.1063, "קרית אתא"],
  ["יבנה", "Yavne", 31.8781, 34.7383, "Yavneh"],
  ["אילת", "Eilat", 29.5577, 34.9519, "Elat"],
  ["אום אל-פחם", "Umm al-Fahm", 32.5195, 35.1524, "אום אל פחם"],
  ["עכו", "Akko", 32.9281, 35.082, "Acre", "Acco"],
  ["כרמיאל", "Karmiel", 32.919, 35.295, "Carmiel"],
  ["טבריה", "Tiberias", 32.7922, 35.5312, "Tveria"],
  ["נס ציונה", "Nes Ziona", 31.9293, 34.7987, "Ness Ziona"],
  ["קריית מוצקין", "Kiryat Motzkin", 32.837, 35.0775, "קרית מוצקין"],
  ["קריית ביאליק", "Kiryat Bialik", 32.8275, 35.0858, "קרית ביאליק"],
  ["קריית ים", "Kiryat Yam", 32.8497, 35.0686, "קרית ים"],
  ["קריית שמונה", "Kiryat Shmona", 33.2073, 35.5697, "קרית שמונה"],
  ["קריית אונו", "Kiryat Ono", 32.055, 34.858, "קרית אונו"],
  ["קריית טבעון", "Kiryat Tivon", 32.716, 35.127, "קרית טבעון"],
  ["קריית מלאכי", "Kiryat Malakhi", 31.731, 34.747, "קרית מלאכי", "Kiryat Malachi"],
  ["קריית עקרון", "Kiryat Ekron", 31.858, 34.822, "קרית עקרון"],
  ["אור יהודה", "Or Yehuda", 32.029, 34.859],
  ["אלעד", "Elad", 32.052, 34.951],
  ["דימונה", "Dimona", 31.07, 35.033],
  ["שדרות", "Sderot", 31.525, 34.596],
  ["נתיבות", "Netivot", 31.421, 34.589],
  ["אופקים", "Ofakim", 31.314, 34.62],
  ["ערד", "Arad", 31.259, 35.213],
  ["ירוחם", "Yeruham", 30.987, 34.931, "Yerucham"],
  ["מצפה רמון", "Mitzpe Ramon", 30.61, 34.801],
  ["רהט", "Rahat", 31.393, 34.754],
  ["להבים", "Lehavim", 31.373, 34.816],
  ["עומר", "Omer", 31.265, 34.85],
  ["מיתר", "Meitar", 31.324, 34.936],
  ["יקנעם עילית", "Yokneam Illit", 32.659, 35.11, "יקנעם", "Yokneam"],
  ["מגדל העמק", "Migdal HaEmek", 32.676, 35.24],
  ["צפת", "Safed", 32.9646, 35.496, "Tzfat", "Zefat"],
  ["בית שאן", "Beit She'an", 32.497, 35.497, "Beit Shean", "Bet Shean"],
  ["מעלות-תרשיחא", "Ma'alot-Tarshiha", 33.016, 35.271, "מעלות", "Maalot"],
  ["נשר", "Nesher", 32.766, 35.044],
  ["טירת כרמל", "Tirat Carmel", 32.76, 34.971],
  ["עתלית", "Atlit", 32.688, 34.939],
  ["אור עקיבא", "Or Akiva", 32.508, 34.92],
  ["זכרון יעקב", "Zichron Yaakov", 32.571, 34.953, "Zikhron Ya'akov"],
  ["פרדס חנה-כרכור", "Pardes Hanna-Karkur", 32.473, 34.97, "פרדס חנה", "כרכור", "Pardes Hanna", "Karkur"],
  ["בנימינה", "Binyamina", 32.521, 34.945],
  ["קיסריה", "Caesarea", 32.5, 34.9, "Qesarya"],
  ["יהוד-מונוסון", "Yehud", 32.033, 34.89, "יהוד", "Yehud-Monosson"],
  ["רמת השרון", "Ramat HaSharon", 32.146, 34.839, "Ramat Hasharon"],
  ["כפר יונה", "Kfar Yona", 32.317, 34.935],
  ["אבן יהודה", "Even Yehuda", 32.27, 34.888],
  ["תל מונד", "Tel Mond", 32.256, 34.918],
  ["קדימה-צורן", "Kadima-Zoran", 32.277, 34.915, "קדימה", "Kadima"],
  ["כוכב יאיר-צור יגאל", "Kokhav Yair", 32.224, 34.995, "כוכב יאיר", "צור יגאל", "Tzur Yigal"],
  ["גדרה", "Gedera", 31.814, 34.779],
  ["מזכרת בתיה", "Mazkeret Batya", 31.854, 34.846],
  ["גן יבנה", "Gan Yavne", 31.787, 34.706],
  ["באר יעקב", "Be'er Ya'akov", 31.942, 34.835, "Beer Yaakov"],
  ["שוהם", "Shoham", 31.999, 34.946],
  ["גני תקווה", "Ganei Tikva", 32.06, 34.873, "גני תקוה"],
  ["סביון", "Savyon", 32.049, 34.877],
  ["גבעת שמואל", "Givat Shmuel", 32.078, 34.849],
  ["מבשרת ציון", "Mevaseret Zion", 31.802, 35.15, "מבשרת", "Mevaseret"],
  ["מעלה אדומים", "Maale Adumim", 31.777, 35.298, "Ma'ale Adumim"],
  ["אריאל", "Ariel", 32.106, 35.187],
  ["ביתר עילית", "Beitar Illit", 31.696, 35.115],
  ["מודיעין עילית", "Modiin Illit", 31.933, 35.042, "Modi'in Illit"],
  ["אפרת", "Efrat", 31.653, 35.149],
  ["כפר קאסם", "Kafr Qasim", 32.114, 34.976, "Kfar Kasem", "Kafr Kasim"],
  ["טייבה", "Tayibe", 32.266, 35.009, "Taibe", "Tayibeh"],
  ["טירה", "Tira", 32.234, 34.95],
  ["קלנסווה", "Qalansawe", 32.285, 34.981],
  ["באקה אל-גרבייה", "Baqa al-Gharbiyye", 32.418, 35.042, "באקה אל גרבייה", "Baka al-Gharbiya"],
  ["סח'נין", "Sakhnin", 32.864, 35.297, "סכנין"],
  ["שפרעם", "Shefa-'Amr", 32.805, 35.17, "Shfar'am", "Shefaram"],
  ["טמרה", "Tamra", 32.853, 35.198],
  ["עראבה", "Arraba", 32.851, 35.336],
  ["נוף הגליל", "Nof HaGalil", 32.707, 35.327, "נצרת עילית", "Nazareth Illit", "Upper Nazareth"],
  ["דאלית אל-כרמל", "Daliyat al-Karmel", 32.693, 35.049, "דלית אל כרמל"],
  ["כפר כנא", "Kafr Kanna", 32.747, 35.342],
  ["מע'אר", "Maghar", 32.89, 35.407, "מגאר"],
  ["קצרין", "Katzrin", 32.993, 35.692, "Qatzrin"],
  ["ראש פינה", "Rosh Pina", 32.969, 35.542, "Rosh Pinna"],
];

/** Lowercase, no quotes/geresh, hyphens and runs of spaces become one space, "qiryat" spelled "kiryat". */
export function normalizeCityName(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/['"`׳״’]/g, "")
    .replace(/[-_–]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^qiryat /, "kiryat ")
    .replace(/^קרית /, "קריית ")
    .trim();
}

type City = { id: number; lat: number; lon: number };

const BY_NAME = new Map<string, City>();
CITIES.forEach(([he, en, lat, lon, ...aliases], id) => {
  for (const name of [he, en, ...aliases]) BY_NAME.set(normalizeCityName(name), { id, lat, lon });
});

const findCity = (name: string | null) => (name ? BY_NAME.get(normalizeCityName(name)) : undefined);

/** Same place: same known city (any spelling or language), or the same text when the city isn't in the list. */
export function isSameCity(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const ca = findCity(a);
  const cb = findCity(b);
  if (ca && cb) return ca.id === cb.id;
  return normalizeCityName(a) === normalizeCityName(b);
}

/** Straight-line distance in km between two city names, or null when either city isn't in the list. */
export function cityDistanceKm(a: string | null, b: string | null): number | null {
  const ca = findCity(a);
  const cb = findCity(b);
  if (!ca || !cb) return null;
  const rad = Math.PI / 180;
  const dLat = (cb.lat - ca.lat) * rad;
  const dLon = (cb.lon - ca.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(ca.lat * rad) * Math.cos(cb.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
