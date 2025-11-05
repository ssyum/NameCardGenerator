import csv
import random

first_names = [
    "Anna", "Max", "Lena", "Paul", "Sophie", "Ben", "Julia", "Leon", "Marie", "Finn",
    "Laura", "Noah", "Emma", "Luis", "Lea", "Jonas", "Emily", "Erik", "Luca", "Mia",
    "Maja", "Moritz", "Ida", "Felix", "Clara", "Philipp", "Sarah", "Elias", "Amelie", "Tim"
]
last_names = [
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
    "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun",
    "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schumacher", "Krause", "Meier", "Lehmann"
]

with open("dummy_names.csv", "w", newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(["Vorname", "Nachname"])
    for _ in range(12):
        vorname = random.choice(first_names)
        nachname = random.choice(last_names)
        writer.writerow([vorname, nachname])

print("CSV file 'dummy_names.csv' has been generated.")