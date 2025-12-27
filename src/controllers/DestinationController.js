import { searchDestinations } from '../../services/destination/autocompleteService.js';

const destinationController = async (req, res) => {
  try {
    const { query, locale = 'en' } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query parameter is required and must be a string',
        field: 'query'
      });
    }

    if (query.trim().length < 2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query must be at least 2 characters',
        field: 'query'
      });
    }

    console.log(`🔍 Destination search: query="${query}", locale="${locale}"`);

    const result = await searchDestinations(query, locale, 10);

    if (result.error) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      status: 'ok',
      data: {
        destinations: result.results,
        total: result.total
      },
      meta: {
        from_cache: result.from_cache,
        duration_ms: result.duration_ms,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Destination controller error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process destination request',
      timestamp: new Date().toISOString()
    });
  }
};

export default destinationController;