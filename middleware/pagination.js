const validatePagination = (req, res, next) => {
    let { page, limit, sortBy, sortOrder } = req.query;

    // Parse and validate page
    page = parseInt(page);
    if (isNaN(page) || page < 1) {
        req.query.page = 1;
    } else {
        req.query.page = page;
    }

    // Parse and validate limit
    limit = parseInt(limit);
    if (isNaN(limit) || limit < 1) {
        req.query.limit = 10;
    } else if (limit > 100) {
        req.query.limit = 100;
    } else {
        req.query.limit = limit;
    }

    // Default sort parameters
    req.query.sortBy = sortBy || 'createdAt';
    req.query.sortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    next();
};

module.exports = validatePagination;
