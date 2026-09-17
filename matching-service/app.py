from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "Matching service is running"})

@app.route('/match', methods=['POST'])
def match():
    data = request.get_json()

    my_skills_wanted = data.get('mySkillsWanted', [])
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
            results.append({
                "id": candidate.get('id'),
                "name": candidate.get('name'),
                "matchedSkills": list(overlap),
                "score": score
            })

    # Best matches first
    results.sort(key=lambda r: r['score'], reverse=True)

    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000)