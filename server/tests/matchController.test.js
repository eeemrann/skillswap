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
});
