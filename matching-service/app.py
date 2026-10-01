import math
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from flask import Flask, request, jsonify

app = Flask(__name__)
ALLOWED_RADIUS_KM = {25, 50, 100, 200, 400}
DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
WEEK_MINUTES = 7 * 24 * 60


@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "Matching service is running"})


@app.route('/match', methods=['POST'])
def match():
    """Scores candidates for a member.

    score = wanted skills the candidate teaches
          + 0.5  if the candidate also wants a skill the member teaches (a true swap)
          + 0.25 if weekly availability overlaps (timezone-aware)
          + 0.25 if locations match
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A JSON object is required"}), 400

    my_skills_wanted = data.get('mySkillsWanted', []) or []
    my_skills_offered = data.get('mySkillsOffered', []) or []
    my_location = data.get('myLocation', {}) or {}
    my_availability = data.get('myAvailability', []) or []
    my_timezone = data.get('myTimezone') or 'UTC'
    radius_km = parse_radius_km(data.get('radiusKm'))
    candidates = data.get('candidates', [])
    if not isinstance(candidates, list) or not all(isinstance(candidate, dict) for candidate in candidates):
        return jsonify({"message": "candidates must be a list of objects"}), 400

    wanted_set = normalize(my_skills_wanted)
    offered_set = normalize(my_skills_offered)
    results = []
    for candidate in candidates:
        overlap = wanted_set & normalize(candidate.get('skillsOffered', []))
        if not overlap:
            continue
        mutual = offered_set & normalize(candidate.get('skillsWanted', []))
        availability_overlap = availability_score(
            my_availability, candidate.get('availability', []) or [], my_timezone, candidate.get('timezone') or 'UTC')
        location_overlap, location_result = location_match(my_location, candidate.get('location', {}) or {}, radius_km)
        score = len(overlap) + (0.5 if mutual else 0) + (0.25 if availability_overlap else 0) + (0.25 if location_overlap else 0)
        results.append({
            "id": candidate.get('id'),
            "name": candidate.get('name'),
            "matchedSkills": sorted(overlap),
            "mutualSkills": sorted(mutual),
            "score": round(score, 2),
            "matchReasons": [
                *[f"Offers {skill}" for skill in sorted(overlap)],
                *(["Wants to learn from you too"] if mutual else []),
                *(["Availability overlaps"] if availability_overlap else []),
                *(["Worldwide" if radius_km == "worldwide" else f"Within {radius_km}km"] if location_overlap and location_result == "coordinates" else []),
                *(["Same location"] if location_overlap and location_result == "city" else [])
            ]
        })

    results.sort(key=lambda r: r['score'], reverse=True)
    return jsonify(results)


def normalize(skills):
    """Lower-cased, trimmed skill set, so "guitar" matches "Guitar"."""
    if not isinstance(skills, list):
        return set()
    return {str(skill).lower().strip() for skill in skills if skill}


def tz_offset_minutes(name, now=None):
    """UTC offset of an IANA timezone in minutes; unknown zones count as UTC."""
    try:
        offset = datetime.now(ZoneInfo(name or 'UTC')) if now is None else now.astimezone(ZoneInfo(name))
        return int(offset.utcoffset().total_seconds() // 60)
    except Exception:
        app.logger.warning("Unknown timezone %r; treating as UTC (is the tzdata package installed?)", name)
        return 0


def to_minutes(value):
    hours, minutes = str(value).split(':')
    return int(hours) * 60 + int(minutes)


def to_utc_intervals(availability, tz_name, now=None):
    """Weekly slots (local weekday + HH:MM) as intervals of minutes since Monday 00:00 UTC."""
    offset = tz_offset_minutes(tz_name, now)
    intervals = []
    for slot in availability:
        try:
            day = DAYS.index(slot.get('day'))
            length = to_minutes(slot.get('end')) - to_minutes(slot.get('start'))
            if length <= 0:
                continue
            start = (day * 1440 + to_minutes(slot.get('start')) - offset) % WEEK_MINUTES
        except (ValueError, AttributeError, TypeError):
            continue
        end = start + length
        if end <= WEEK_MINUTES:
            intervals.append((start, end))
        else:
            intervals.extend([(start, WEEK_MINUTES), (0, end - WEEK_MINUTES)])
    return intervals


def availability_score(first, second, first_tz='UTC', second_tz='UTC', now=None):
    """True when two members share a weekly slot, whatever timezone each is in."""
    if not isinstance(first, list) or not isinstance(second, list):
        return False
    now = now or datetime.now(timezone.utc)
    a = to_utc_intervals([s for s in first if isinstance(s, dict)], first_tz, now)
    b = to_utc_intervals([s for s in second if isinstance(s, dict)], second_tz, now)
    return any(a_start < b_end and b_start < a_end for a_start, a_end in a for b_start, b_end in b)


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
        return 'worldwide'
    return int(radius_km) if radius_km in ALLOWED_RADIUS_KM else 'worldwide'


def haversine_distance_km(first, second):
    longitude_1, latitude_1 = map(math.radians, first)
    longitude_2, latitude_2 = map(math.radians, second)
    delta_latitude = latitude_2 - latitude_1
    delta_longitude = longitude_2 - longitude_1
    a = (math.sin(delta_latitude / 2) ** 2
         + math.cos(latitude_1) * math.cos(latitude_2) * math.sin(delta_longitude / 2) ** 2)
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def location_match(first, second, radius_km='worldwide'):
    if valid_coordinates(first.get('coordinates')) and valid_coordinates(second.get('coordinates')):
        return radius_km == 'worldwide' or haversine_distance_km(first['coordinates'], second['coordinates']) <= radius_km, 'coordinates'

    first_city = str(first.get('city', '')).strip().lower()
    second_city = str(second.get('city', '')).strip().lower()
    return bool(first_city and second_city and first_city == second_city), 'city'


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 6000))
    app.run(host='0.0.0.0', port=port)
