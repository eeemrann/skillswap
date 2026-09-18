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

  test('returns 504 when matching service times out', async () => {
    const req = { userId: 'my-user-id' };
    const res = mockResponse();

    User.findById.mockResolvedValue({
      skillsWanted: ['Spanish'],
      location: { city: 'Dhaka' },
      availability: []
    });

    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        {
          _id: 'candidate-id',
          name: 'Alex',
          skillsOffered: ['Spanish'],
          location: { city: 'Dhaka' },
          availability: []
        }
      ])
    });

    axios.post.mockRejectedValue({ code: 'ECONNABORTED' });

    await getMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ message: 'Matching service timed out. Please try again shortly.' });
  });
});
