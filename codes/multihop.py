"""Construye 50 consultas multisalto: cada una exige recuperar dos documentos de WikiQA y restar sus años.

Los pares se eligieron a mano entre documentos cuyo año describe a la propia entidad; el año se verifica en el texto.
Uso: python codes/multihop.py
"""
import json
from config import DATA, INDEX_DIR

PARES = [  # (doc A, evento A, año A, doc B, evento B, año B)
    ("wiki_98", "the founding of Galveston County", 1838, "wiki_106", "the establishment of Atlanta", 1837),
    ("wiki_126", "the opening of Central Park", 1857, "wiki_1417", "the opening of the Kennywood amusement park", 1898),
    ("wiki_172", "the first publication of Newton's Principia Mathematica", 1687, "wiki_763", "the publication of The Rime of the Ancient Mariner", 1798),
    ("wiki_409", "the founding of Major League Soccer", 1993, "wiki_1284", "the founding of the NBA", 1946),
    ("wiki_665", "the founding of Fidelity Investments", 1946, "wiki_964", "the founding of Jennifer Convertibles", 1975),
    ("wiki_693", "the establishment of the Texas Rangers baseball franchise", 1961, "wiki_852", "the founding of the New York Jets", 1959),
    ("wiki_720", "the formation of DC Talk", 1987, "wiki_728", "the formation of 30 Seconds to Mars", 1998),
    ("wiki_825", "the construction of the Globe Theatre", 1599, "wiki_773", "the construction of the chapel of Mission San Juan Capistrano", 1782),
    ("wiki_1064", "the discovery of the moons of Mars", 1877, "wiki_744", "the discovery of the electron by J. J. Thomson", 1897),
    ("wiki_633", "the establishment of the office of Speaker of the House", 1789, "wiki_1480", "the founding of the United Nations", 1945),
    ("wiki_1095", "the founding of Popeyes Louisiana Kitchen", 1972, "wiki_1630", "the establishment of Southwest Airlines", 1967),
    ("wiki_1625", "the formation of the band Muse", 1994, "wiki_1499", "the formation of Westlife", 1998),
    ("wiki_767", "the original release of iOS", 2007, "wiki_1318", "the release of the first BlackBerry device", 1999),
    ("wiki_1276", "the publication of Rip Van Winkle", 1819, "wiki_305", "the publication of the first Redwall book", 1986),
    ("wiki_1223", "the founding of the Pittsburgh Steelers", 1933, "wiki_1001", "the founding of Bally Technologies", 1968),
]

# 35 pares más para completar 50 consultas complejas. Se buscaron artículos cuyo primer párrafo da un solo año
# para la propia entidad (nacimiento, fundación, publicación o lanzamiento) y se emparejaron con semilla fija.
PARES += [
    ("wiki_2219", "the release of the 3 Doors Down song Here Without You", 2003, "wiki_613", "the release of the Aerosmith song What It Takes", 1990),
    ("wiki_2123", "the birth of 50 Cent", 1975, "wiki_1381", "the birth of Johnny Depp", 1963),
    ("wiki_117", "the publication of the Book of Mormon", 1830, "wiki_2587", "the release of the film Deep Blue Sea", 1999),
    ("wiki_288", "the birth of Sidney Crosby", 1987, "wiki_188", "the birth of Elaine Stritch", 1925),
    ("wiki_1035", "the introduction of the McMuffin", 1972, "wiki_905", "the founding of the Organization of American States", 1948),
    ("wiki_1530", "the birth of Keith Richards", 1943, "wiki_1797", "the birth of Jennifer Aniston", 1969),
    ("wiki_841", "the release of the U2 song Where the Streets Have No Name", 1987, "wiki_616", "the release of the PlayStation 3", 2006),
    ("wiki_371", "the birth of Candace Parker", 1986, "wiki_2506", "the birth of news anchor Brian Williams", 1959),
    ("wiki_372", "the publication of the food guide pyramid", 1974, "wiki_2408", "the release of the video game Tiger Woods PGA Tour 11", 2010),
    ("wiki_697", "the birth of Nelly Furtado", 1978, "wiki_2509", "the birth of the fictional character Barney Stinson", 1976),
    ("wiki_1892", "the release of the Rascal Flatts song Why", 2009, "wiki_341", "the creation of Twitter", 2006),
    ("wiki_195", "the birth of basketball player John Starks", 1965, "wiki_1372", "the birth of Mark Zuckerberg", 1984),
    ("wiki_2019", "the creation of the Federal Reserve System", 1913, "wiki_1645", "the founding of the National Birth Control League", 1915),
    ("wiki_849", "the birth of basketball player Mark Jackson", 1965, "wiki_2746", "the birth of Oprah Winfrey", 1954),
    ("wiki_168", "the launch of Yahoo! Mail", 1997, "wiki_2744", "the release of the Blink-182 album Enema of the State", 1999),
    ("wiki_1907", "the birth of the rapper K-os", 1972, "wiki_2312", "the birth of Dylan and Cole Sprouse", 1992),
    ("wiki_2493", "the release of the Alannah Myles song Black Velvet", 1989, "wiki_835", "the release of the Xbox", 2001),
    ("wiki_1369", "the birth of Gavin Rossdale", 1967, "wiki_2740", "the birth of the wrestler Triple H", 1969),
    ("wiki_2624", "the release of the Linkin Park song Waiting for the End", 2010, "wiki_1847", "the release of the film Scream 3", 2000),
    ("wiki_1371", "the birth of Julia Roberts", 1967, "wiki_1363", "the birth of Victoria Jackson", 1959),
    ("wiki_2217", "the release of the Carrie Underwood song Just a Dream", 2008, "wiki_824", "the formation of ExxonMobil", 1999),
    ("wiki_608", "the birth of Eminem", 1972, "wiki_2022", "the birth of Mark Cuban", 1958),
    ("wiki_1615", "the construction of the Brown Palace Hotel in Denver", 1892, "wiki_1986", "the establishment of the Grammy Award for Song of the Year", 1958),
    ("wiki_842", "the birth of Tom Hanks", 1956, "wiki_2054", "the birth of Joe Bonamassa", 1977),
    ("wiki_1770", "the publication of the song I'm in the Mood for Love", 1935, "wiki_1167", "the publication of the short story There Will Come Soft Rains", 1950),
    ("wiki_2039", "the birth of Tiger Woods", 1975, "wiki_1916", "the birth of Soulja Boy", 1990),
    ("wiki_2731", "the release of the Evanescence song Going Under", 2003, "wiki_1508", "the launch of the Sumlock ANITA calculator", 1961),
    ("wiki_176", "the birth of Magic Johnson", 1959, "wiki_1843", "the birth of Roseanne Barr", 1952),
    ("wiki_8", "the founding of Purdue University", 1869, "wiki_1422", "the release of the Flo Rida song Right Round", 2009),
    ("wiki_2627", "the birth of Marc Anthony", 1968, "wiki_414", "the birth of the rapper DMX", 1970),
    ("wiki_2110", "the release of the City High song What Would You Do?", 2001, "wiki_1336", "the release of the Nicki Minaj song Roman's Revenge", 2010),
    ("wiki_765", "the birth of Zendaya", 1996, "wiki_2605", "the birth of Ben Carson", 1951),
    ("wiki_2372", "the public introduction of Wicca", 1954, "wiki_807", "the introduction of the drug sertraline", 1991),
    ("wiki_1534", "the birth of Natalie Portman", 1981, "wiki_2660", "the birth of basketball player Antoine Walker", 1976),
    ("wiki_1657", "the creation of the Heisman Trophy", 1935, "wiki_301", "the introduction of the Kawasaki Ninja ZX-6R", 1995),
]

if __name__ == "__main__":
    textos = {d["id"]: d["texto"] for d in json.load(open(INDEX_DIR / "docs.json"))}
    consultas = []
    for i, (a, ea, ya, b, eb, yb) in enumerate(PARES):
        assert str(ya) in textos[a] and str(yb) in textos[b], (a, b)  # el año está en el documento
        consultas.append({"id": f"multihop_q{i}", "tipo": "multihop", "docs_oro": [a, b], "respuesta_oro": str(abs(ya - yb)),
                          "pregunta": f"How many years passed between {ea} and {eb}? End your answer with a line: Final answer: number"})
    json.dump(consultas, open(DATA / "consultas_multisalto.json", "w"), ensure_ascii=False, indent=2)
    print(len(consultas), "consultas multisalto")
