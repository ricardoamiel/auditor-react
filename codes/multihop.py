"""Construye 15 consultas multisalto: cada una exige recuperar dos documentos de WikiQA y restar sus años.

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

if __name__ == "__main__":
    textos = {d["id"]: d["texto"] for d in json.load(open(INDEX_DIR / "docs.json"))}
    consultas = []
    for i, (a, ea, ya, b, eb, yb) in enumerate(PARES):
        assert str(ya) in textos[a] and str(yb) in textos[b], (a, b)  # el año está en el documento
        consultas.append({"id": f"multihop_q{i}", "tipo": "multihop", "docs_oro": [a, b], "respuesta_oro": str(abs(ya - yb)),
                          "pregunta": f"How many years passed between {ea} and {eb}? End your answer with a line: Final answer: number"})
    json.dump(consultas, open(DATA / "consultas_multisalto.json", "w"), ensure_ascii=False, indent=2)
    print(len(consultas), "consultas multisalto")
