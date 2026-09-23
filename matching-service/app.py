
import math
import os

from flask import Flask, request, jsonify

app = Flask(__name__)
ALLOWED_RADIUS_KM = {25, 50, 100, 200, 400}

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "Matching service is running"})

@app.route('/match', methods=['POST'])
def match():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A JSON object is required"}), 400

    my_skills_wanted = data.get('mySkillsWanted', [])
    my_location = data.get('myLocation', {}) or {}
    my_availability = data.get('myAvailability', []) or []
    radius_km = parse_radius_km(data.get('radiusKm'))
    candidates = data.get('candidates', [])  # list of { id, name, skillsOffered }
    if not isinstance(candidates, list) or not all(isinstance(candidate, dict) for candidate in candidates):
        return jsonify({"message": "candidates must be a list of objects"}), 400

    # Normalize to lowercase so "guitar" matches "Guitar"
    wanted_set = set(str(s).lower().strip() for s in my_skills_wanted if s)
    results = []
    for candidate in candidates:
        offered = candidate.get('skillsOffered', [])
        offered_set = set(str(s).lower().strip() for s in offered if s)

        # Score = how many of the skills I want, this person offers
        overlap = wanted_set.intersection(offered_set)
        score = len(overlap)

        if score > 0:
            availability_overlap = availability_score(my_availability, candidate.get('availability', []))
            location_overlap, location_result = location_match(my_location, candidate.get('location', {}) or {}, radius_km)
            weighted_score = score + (0.25 if availability_overlap else 0) + (0.25 if location_overlap else 0)
            results.append({
                "id": candidate.get('id'),
                "name": candidate.get('name'),
                "matchedSkills": list(overlap),
                "score": round(weighted_score, 2),
                "matchReasons": [
                    *[f"Offers {skill}" for skill in overlap],
                    *(["Availability overlaps"] if availability_overlap else []),
                    *(["Worldwide" if radius_km == "worldwide" else f"Within {radius_km}km"] if location_overlap and location_result == "coordinates" else []),
                    *(["Same location"] if location_overlap and location_result == "city" else [])
                ]
            })

    # Best matches first
    results.sort(key=lambda r: r['score'], reverse=True)

    return jsonify(results)

def availability_score(first, second):
    first_slots = [slot for slot in first if isinstance(slot, dict)]
    second_slots = [slot for slot in second if isinstance(slot, dict)]
    return any(a.get('day') == b.get('day') and a.get('start', '') < b.get('end', '') and b.get('start', '') < a.get('end', '') for a in first_slots for b in second_slots)

def valid_coordinates(coordinates):
    return (
        isinstance(coordinates, list) and len(coordinates) == 2
        and all(isinstance(coordinate, (int, float)) and math.isfinite(coordinate) for coordinate in coordinates)
    )


def parse_radius_km(value):
    if str(value or '').strip().lower() == 'worldwide':
        return 'worldwide'
    try:
        radius_km = float(value)
    except (TypeError, ValueError):
        return 25
    return int(radius_km) if radius_km in ALLOWED_RADIUS_KM else 25


def haversine_distance_km(first, second):
    longitude_1, latitude_1 = map(math.radians, first)
    longitude_2, latitude_2 = map(math.radians, second)
    delta_latitude = latitude_2 - latitude_1
    delta_longitude = longitude_2 - longitude_1
    a = (math.sin(delta_latitude / 2) ** 2
         + math.cos(latitude_1) * math.cos(latitude_2) * math.sin(delta_longitude / 2) ** 2)
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def location_match(first, second, radius_km=25):
    if valid_coordinates(first.get('coordinates')) and valid_coordinates(second.get('coordinates')):
        return radius_km == 'worldwide' or haversine_distance_km(first['coordinates'], second['coordinates']) <= radius_km, 'coordinates'

    first_city = str(first.get('city', '')).strip().lower()
    second_city = str(second.get('city', '')).strip().lower()
    return bool(first_city and second_city and first_city == second_city), 'city'

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 6000))
    app.run(host='0.0.0.0', port=port)
