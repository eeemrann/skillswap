
import os

from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "Matching service is running"})

@app.route('/match', methods=['POST'])
def match():
    data = request.get_json()

    my_skills_wanted = data.get('mySkillsWanted', [])
    my_location = data.get('myLocation', {}) or {}
    my_availability = data.get('myAvailability', []) or []
    candidates = data.get('candidates', [])  # list of { id, name, skillsOffered }

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
            location_overlap = location_match(my_location, candidate.get('location', {}))
            weighted_score = score + (0.25 if availability_overlap else 0) + (0.25 if location_overlap else 0)
            results.append({
                "id": candidate.get('id'),
                "name": candidate.get('name'),
                "matchedSkills": list(overlap),
                "score": round(weighted_score, 2),
                "matchReasons": [
                    *[f"Offers {skill}" for skill in overlap],
                    *(["Availability overlaps"] if availability_overlap else []),
                    *(["Same location"] if location_overlap else [])
                ]
            })

    # Best matches first
    results.sort(key=lambda r: r['score'], reverse=True)

    return jsonify(results)

def availability_score(first, second):
    first_slots = {(slot.get('day'), slot.get('start'), slot.get('end')) for slot in first if isinstance(slot, dict)}
    second_slots = {(slot.get('day'), slot.get('start'), slot.get('end')) for slot in second if isinstance(slot, dict)}
    return bool(first_slots.intersection(second_slots))

def location_match(first, second):
    first_city = str(first.get('city', '')).strip().lower()
    second_city = str(second.get('city', '')).strip().lower()
    return bool(first_city and second_city and first_city == second_city)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 6000))
    app.run(host='0.0.0.0', port=port)