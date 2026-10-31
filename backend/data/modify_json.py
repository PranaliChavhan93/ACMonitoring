import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

GEO_INPUT  = os.path.join(BASE_DIR, "locationData_geographical.json")
GEO_OUTPUT = os.path.join(BASE_DIR, "locationData_geographical_modified.json")

ZONAL_INPUT  = os.path.join(BASE_DIR, "locationData_zonal.json")
ZONAL_OUTPUT = os.path.join(BASE_DIR, "locationData_zonal_modified.json")


def clean_geographical(data):
    """country -> states -> districts -> talukas -> cities (branches forced to [])"""
    for country in data:
        for state in country.get("states", []):
            for district in state.get("districts", []):
                for taluka in district.get("talukas", []):
                    # Hierarchy stops at city, so strip any taluka-level branches
                    taluka.pop("branches", None)
                    taluka.pop("sites", None)
                    # Blank out branches on each city
                    for city in taluka.get("cities", []):
                        city["branches"] = []
    return data


def clean_zonal(data):
    """country -> zones -> circles -> regions -> divisions (branches forced to [])"""
    for country in data:
        for zone in country.get("zones", []):
            for circle in zone.get("circles", []):
                for region in circle.get("regions", []):
                    for division in region.get("divisions", []):
                        # Blank out branches on each division
                        division["branches"] = []
    return data


def detect_and_clean(data):
    """Auto-detect structure and apply the correct cleaner."""
    if not data:
        return data, "empty"
    sample = data[0]
    if "states" in sample:
        return clean_geographical(data), "geographical"
    if "zones" in sample:
        return clean_zonal(data), "zonal"
    raise SystemExit("Unrecognised JSON structure (neither 'states' nor 'zones' found at top level).")


def process(input_path, output_path, label):
    if not os.path.exists(input_path):
        print(f"[skip] {label}: input not found -> {input_path}")
        return
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    data, kind = detect_and_clean(data)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"[ok]   {label} ({kind}) -> {output_path}")


if __name__ == "__main__":
    process(GEO_INPUT,   GEO_OUTPUT,   "Geographical")
    process(ZONAL_INPUT, ZONAL_OUTPUT, "Zonal")
    print("Done.")