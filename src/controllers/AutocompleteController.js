import { searchDestinations } from '../../services/destination/autocompleteService.js';

export async function autocompleteDestinations(req, res) {
  try {
    const { query, locale = 'en', limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query parameter is required',
        field: 'query',
        suggestion: 'Add ?query=your_search_term to the URL'
      });
    }

    const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

    console.log(`🔍 Autocomplete request: query="${query}", locale="${locale}", limit=${parsedLimit}`);

    const result = await searchDestinations(query, locale, parsedLimit);

    // Separate hotels and destinations for better frontend handling
    const destinations = result.results.filter(r => r.type !== 'hotel');
    const hotels = result.results.filter(r => r.type === 'hotel');

    return res.json({
      status: 'ok',
      data: {
        destinations: destinations,
        hotels: hotels,
        results: result.results, // Combined for backward compatibility
        total: result.total,
        query,
        locale
      },
      meta: {
        from_cache: result.from_cache,
        cache_key: result.cache_key,
        duration_ms: result.duration_ms,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Autocomplete controller error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch destination suggestions',
      timestamp: new Date().toISOString()
    });
  }
}

export default {
  autocompleteDestinations
};
