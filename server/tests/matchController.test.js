const axios = require('axios');
const { getMatches } = require('../controllers/matchController');
const User = require('../models/User');

jest.mock('axios');
jest.mock('../models/User');

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('matchController.getMatches', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MATCHING_SERVICE_TIMEOUT_MS;
  });

  test('falls back to local matching when matching service times out', async () => {
    const req = { userId: 'my-user-id' };
    const res = mockResponse();

    User.findById.mockResolvedValue({
      skillsWanted: ['Spanish'],
      skillsOffered: ['Photography'],
      location: { city: 'Dhaka' },
      availability: []
    });

    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => 'candidate-id' },
          name: 'Alex',
          skillsOffered: ['Spanish'],
          location: { city: 'Dhaka' },
          availability: []
        }
      ])
    });

    axios.post.mockRejectedValue({ code: 'ECONNABORTED' });

    await getMatches(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'candidate-id', name: 'Alex', matchedSkills: ['spanish'], score: 1.25 })
    ]);
  });

  test('uses the selected radius in local matching', async () => {
    User.findById.mockResolvedValue({
      skillsWanted: ['Guitar'],
      location: { coordinates: [0, 0] },
      availability: []
    });
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{
        _id: { toString: () => 'medium-distance-id' },
        name: 'Medium distance',
        skillsOffered: ['Guitar'],
        location: { coordinates: [0.4, 0] },
        availability: []
      }])
    });
    axios.post.mockRejectedValue(new Error('matching service unavailable'));

    const radius50Response = mockResponse();
    await getMatches({ userId: 'my-user-id', query: { radiusKm: '50' } }, radius50Response);
    expect(radius50Response.json).toHaveBeenCalledWith([
      expect.objectContaining({ score: 1.25, matchReasons: ['Offers guitar', 'Within 50km'] })
    ]);

    const radius25Response = mockResponse();
    await getMatches({ userId: 'my-user-id', query: { radiusKm: '25' } }, radius25Response);
    expect(radius25Response.json).toHaveBeenCalledWith([
      expect.objectContaining({ score: 1, matchReasons: ['Offers guitar'] })
    ]);
  });

  test('matches across countries when radius is worldwide', async () => {
    User.findById.mockResolvedValue({
      skillsWanted: ['Guitar'],
      location: { coordinates: [-73.9857, 40.7484] },
      availability: []
    });
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{
        _id: { toString: () => 'australia-id' },
        name: 'Australia',
        skillsOffered: ['Guitar'],
        location: { coordinates: [151.2093, -33.8688] },
        availability: []
      }])
    });
    axios.post.mockRejectedValue(new Error('matching service unavailable'));

    const res = mockResponse();
    await getMatches({ userId: 'my-user-id', query: { radiusKm: 'worldwide' } }, res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ score: 1.25, matchReasons: ['Offers guitar', 'Worldwide'] })
    ]);
  });
});
