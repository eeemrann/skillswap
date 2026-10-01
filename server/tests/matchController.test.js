const axios = require('axios');
const { getMatches, matchLocally } = require('../controllers/matchController');
const User = require('../models/User');

jest.mock('axios');
jest.mock('../models/User');

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

const candidates = (list) => User.find.mockReturnValue({
  select: () => ({ limit: () => ({ lean: () => Promise.resolve(list) }) })
});

const me = (overrides = {}) => ({ _id: 'me', skillsWanted: ['Guitar'], skillsOffered: [], location: {}, availability: [], timezone: 'UTC', ...overrides });
const person = (overrides = {}) => ({ _id: { toString: () => 'c1' }, name: 'Alex', skillsOffered: ['Guitar'], skillsWanted: [], location: {}, availability: [], timezone: 'UTC', ...overrides });

describe('matchController.getMatches', () => {
  beforeEach(() => axios.post.mockRejectedValue(new Error('matching service unavailable')));
  afterEach(() => jest.clearAllMocks());

  test('returns nothing without querying when the member wants no skills', async () => {
    const res = response();
    await getMatches({ user: me({ skillsWanted: [] }), query: {} }, res);
    expect(res.json).toHaveBeenCalledWith([]);
    expect(User.find).not.toHaveBeenCalled();
  });

  test('falls back to local matching when the matching service is unavailable and enriches results', async () => {
    candidates([person({ skillsOffered: ['Spanish'], profilePicture: 'p.png', location: { city: 'Dhaka' }, plan: 'pro' })]);
    const res = response();
    await getMatches({ user: me({ skillsWanted: ['Spanish'], location: { city: 'Dhaka' } }), query: {} }, res);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c1', name: 'Alex', matchedSkills: ['spanish'], score: 1.25, profilePicture: 'p.png', city: 'Dhaka', isPro: true })
    ]);
  });

  test('prefers the matching service when it answers', async () => {
    candidates([person()]);
    axios.post.mockResolvedValue({ data: [{ id: 'c1', name: 'Alex', matchedSkills: ['guitar'], score: 9 }] });
    const res = response();
    await getMatches({ user: me(), query: { radiusKm: '50' } }, res);
    expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/match$/), expect.objectContaining({ radiusKm: 50, mySkillsWanted: ['Guitar'] }), expect.any(Object));
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ score: 9 })]);
  });
});

describe('matchLocally scoring', () => {
  const run = (mine, other, radius = 'worldwide') => matchLocally(mine, [{ id: 'c1', name: 'A', skillsOffered: [], skillsWanted: [], location: {}, availability: [], timezone: 'UTC', ...other }], radius);

  test('uses the selected radius for the location bonus', () => {
    const mine = me({ location: { coordinates: [0, 0] } });
    const other = { skillsOffered: ['Guitar'], location: { coordinates: [0.4, 0] } };
    expect(run(mine, other, 50)[0]).toMatchObject({ score: 1.25, matchReasons: ['Offers guitar', 'Within 50km'] });
    expect(run(mine, other, 25)[0]).toMatchObject({ score: 1, matchReasons: ['Offers guitar'] });
  });

  test('matches across continents when the radius is worldwide', () => {
    const mine = me({ location: { coordinates: [-73.9857, 40.7484] } });
    const other = { skillsOffered: ['Guitar'], location: { coordinates: [151.2093, -33.8688] } };
    expect(run(mine, other)[0]).toMatchObject({ score: 1.25, matchReasons: ['Offers guitar', 'Worldwide'] });
  });

  test('rewards a true swap, where the candidate also wants something the member teaches', () => {
    const mine = me({ skillsOffered: ['Design'] });
    const swap = run(mine, { skillsOffered: ['Guitar'], skillsWanted: ['design'] })[0];
    expect(swap).toMatchObject({ score: 1.5, mutualSkills: ['design'] });
    expect(swap.matchReasons).toContain('Wants to learn from you too');
  });

  test('compares availability across timezones, not by wall-clock time', () => {
    // 09:00-10:00 in New York (UTC-4 or -5) is the same instant as 14:00-15:00 or 15:00-16:00 in London.
    const slot = (start, end) => [{ day: 'wednesday', start, end }];
    const mine = me({ timezone: 'America/New_York', availability: slot('09:00', '10:00') });
    const sameInstant = run(mine, { skillsOffered: ['Guitar'], timezone: 'Europe/London', availability: slot('13:00', '16:00') })[0];
    expect(sameInstant.matchReasons).toContain('Availability overlaps');
    const sameClock = run(mine, { skillsOffered: ['Guitar'], timezone: 'Europe/London', availability: slot('09:00', '10:00') })[0];
    expect(sameClock.matchReasons).not.toContain('Availability overlaps');
  });

  test('ignores candidates who teach nothing the member wants', () => {
    expect(run(me(), { skillsOffered: ['Cooking'] })).toEqual([]);
  });
});
