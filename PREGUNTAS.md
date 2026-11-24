# Banco de preguntas para probar el sistema

Este archivo resume qué contiene cada parte de la base de conocimiento y propone preguntas que el RAG sí puede responder. Las de WikiQA se verificaron contra el índice real: el documento correcto sale en el primer puesto de la búsqueda. Las de matemáticas y código vienen de los conjuntos de prueba de GSM8K y MBPP, que no están en el índice, y se incluye la respuesta esperada. Ninguna pertenece a las 50 consultas de la evaluación.

Las preguntas van en inglés porque los tres datasets están en inglés y así la búsqueda encuentra el documento. El modelo responde igual de bien si después se le pide la respuesta en español.

## Qué tiene la base de conocimiento

| Fuente | Documentos | Largo típico | Qué es cada documento | Para qué sirve |
|---|---|---|---|---|
| WikiQA | 2 811 | 1 065 caracteres | Un artículo de Wikipedia por título, armado con las oraciones candidatas del dataset | Preguntas de hechos: quién, cuándo, dónde, qué significa |
| GSM8K | 7 473 | 511 caracteres | Un problema escolar de matemáticas con su solución paso a paso y el número final | Ejemplos resueltos parecidos al problema nuevo; el cálculo lo hace ejecutar_python |
| MBPP | 474 | 240 caracteres | Un enunciado de programación con su función de referencia en Python | Funciones parecidas como guía; los tests se ejecutan antes de entregar |

Lo importante de cada una:

1. **WikiQA** cubre sobre todo cultura general de Estados Unidos (personas, películas, música, historia, ciencia y salud). Tiene algo de matemáticas (rango de una función, teorema fundamental del cálculo, razón áurea, constantes) y muy poco de Perú: Machu Picchu sí está, pero no hay literatura ni historia peruana. Para eso el multiagente usa la búsqueda web.
2. **GSM8K** no responde preguntas por sí sola: aporta problemas resueltos con la misma estructura (porcentajes, promedios, proporciones). El acierto en matemáticas sale de calcular con Python, no de copiar el ejemplo.
3. **MBPP** funciona igual: el índice trae funciones parecidas y el Auditor comprueba que la nueva función pase los tests.
4. Si una pregunta no está en ninguna de las tres, el Naive RAG responde que el contexto no la contiene y el multiagente busca en la web.

## Qué modo usar

| Tipo de pregunta | Modo recomendado | Tiempo con el 7B |
|---|---|---|
| Hecho que está en WikiQA | Naive RAG | unos 5 s |
| Hecho que no está en la base | Multiagente | 15 a 45 s |
| Problema de matemáticas | Multiagente | 20 a 45 s |
| Función de Python con tests | Multiagente con Auditor | 10 a 70 s |
| Pregunta que combina dos documentos | Multiagente | 20 a 55 s |

## 1. Hechos (WikiQA)

### Matemáticas

| Pregunta | Documento | Qué debería responder |
|---|---|---|
| What Is Range in Math | Range (mathematics) | El conjunto de valores que toma una función |
| what is the fundamental theorem of calculus used for | Fundamental theorem of calculus | Une la derivada con la integral |
| how do you know if something is the golden ratio | Golden ratio | Cuando la razón entre la suma y la mayor es igual a la razón entre la mayor y la menor |
| what is a constant in math? | Mathematical constant | Un número especial, usualmente real, como pi o e |
| what does a plus minus sign mean | Plus-minus sign | Indica dos valores posibles o la precisión de una aproximación |
| how many percent is a basis point | Basis point | Una centésima de punto porcentual |
| how is slugging percentage calculated | Slugging percentage | Bases totales divididas entre turnos al bate |
| what was the Name the first electronic handheld calculator | Sumlock ANITA calculator | ANITA Mark VII y Mark VIII, de 1961 |

### Perú y Sudamérica

| Pregunta | Documento | Qué debería responder |
|---|---|---|
| In which country is Machu Picchu located and in which century was it built? | Machu Picchu | Perú, a mediados del siglo XV (comprobado con el 7B: 16 s) |
| what is el mate | Mate (beverage) | Infusión tradicional de Sudamérica |
| where are poison dart frog seen | Poison dart frog | Centro y Sudamérica |

### Cultura general

| Pregunta | Qué debería responder |
|---|---|
| what year was the eiffel tower made | 1889 |
| who is the founder of twitter | Jack Dorsey, en 2006 |
| how many humps on a camel | Una el dromedario y dos el bactriano |
| what did tycho brahe do | Astrónomo danés |
| who sang I want to dance with somebody | Whitney Houston |
| what is nicki minaj real name | Onika Tanya Maraj |
| what was the first year of kentucky derby | 1875 |
| how many grams in a troy ounce of gold | 31.1 gramos |

## 2. Hechos que requieren la web (solo multiagente)

Estas preguntas no están en la base. Se probaron con el 7B en modo multiagente.

| Pregunta | Respuesta obtenida | Tiempo |
|---|---|---|
| Who wrote the novel The Time of the Hero (La ciudad y los perros)? | Mario Vargas Llosa | 42 s |
| In what year did Peru declare its independence? | 1821 | 41 s |
| Show the Bhaskara formula for the general solution of a second order equation | x = (−b ± √(b² − 4ac)) / 2a | 58 s |

## 3. Matemáticas (GSM8K)

| Pregunta | Respuesta |
|---|---|
| If 6 potatoes makes 36 hash browns, how many hash browns can you make out of 96 potatoes? | 576 |
| There are 26 countries in South America and, in each country, there are 5 cities with 1000 people living in each city. If the whole population lives in these cities, how many people are there in South America? | 130000 |
| Josh decides to try flipping a house. He buys a house for $80,000 and then puts in $50,000 in repairs. This increased the value of the house by 150%. How much profit did he make? | 70000 |
| Maria buys 8 shares of a stock for $8 each. The stock price increases 50% the first year Maria holds it, then decreases 25% in the second year. What is the final value of all Maria's shares? | 72 |
| To have the car for the weekend, Wilson's report card needs to show that he received 80 or higher in his math class. His math grade is calculated by the average of 5 test scores. On those tests, he received: 65, 94, 81, 86 and 74. What is his current math grade? | 80 |
| Sarah went to buy books from the store and spent $300 on the books. If each book was $15 and she gave an equal number of books to her 4 kids, how many books did each child get? | 5 |

## 4. Código (MBPP)

Se copia el bloque completo, con la línea de los tests. El Auditor ejecuta esos assert antes de aprobar.

Raíces de una ecuación cuadrática (relacionada con Bhaskara):
```
Write a python function to check whether one root of the quadratic equation is twice of the other or not.
Your code must pass these tests:
assert Check_Solution(1,3,2) == "Yes"
assert Check_Solution(1,2,3) == "No"
assert Check_Solution(1,-5,6) == "No"
```

Mayor factor primo:
```
Write a python function to find the largest prime factor of a given number.
Your code must pass these tests:
assert max_Prime_Factors(15) == 5
assert max_Prime_Factors(6) == 3
assert max_Prime_Factors(2) == 2
```

Cantidad de primos menores que n:
```
Write a python function to count the number of prime numbers less than a given non-negative number.
Your code must pass these tests:
assert count_Primes_nums(5) == 2
assert count_Primes_nums(10) == 4
assert count_Primes_nums(100) == 25
```

Área de una esfera:
```
Write a function to find the surface area of a sphere.
Your code must pass these tests:
assert surfacearea_sphere(10)==1256.6370614359173
assert surfacearea_sphere(15)==2827.4333882308138
assert surfacearea_sphere(20)==5026.548245743669
```

Probabilidad binomial:
```
Write a function to compute binomial probability for the given number.
Your code must pass these tests:
assert binomial_probability(10, 5, 1.0/3) == 0.13656454808718185
assert binomial_probability(11, 6, 2.0/4) == 0.2255859375
assert binomial_probability(12, 7, 3.0/5) == 0.227030335488
```

## 5. Multisalto: dos documentos y un cálculo

Son las mejores para comparar en vivo: conviene correrlas en modo multiagente y luego en Naive RAG. En la evaluación con 50 consultas complejas el multiagente acertó 0.88 y el Naive 0.28.

| Pregunta | Respuesta |
|---|---|
| How many years passed between the opening of Central Park and the opening of the Kennywood amusement park? End your answer with a line: Final answer: number | 41 |
| How many years passed between the founding of Major League Soccer and the founding of the NBA? End your answer with a line: Final answer: number | 47 |
| How many years passed between the first publication of Newton's Principia Mathematica and the publication of The Rime of the Ancient Mariner? End your answer with a line: Final answer: number | 111 |

Un caso que muestra los límites: "How many years passed between the founding of Lima and the declaration of independence of Peru? End your answer with a line: Final answer: number". Lima se fundó en 1535 y la independencia fue en 1821, así que la respuesta es 286, pero el 7B respondió 287 en 47 s. Ninguno de los dos años está en la base, el sistema los buscó en la web y el Auditor no detectó el error de la resta. Sirve para discutir por qué el Auditor debería verificar también los cálculos.
