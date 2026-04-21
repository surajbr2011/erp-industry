require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// Security — configured for cross-origin API usage
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP — this is a pure API server, CSP is for HTML pages
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin fetch from Netlify frontend
    crossOriginOpenerPolicy: false, // Not needed for API server
}));
app.use(cors({
    origin: true, // Allow all origins, or automatically reflect request origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Logging & Body parsing
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auto-initialize database on startup
try {
    const { setup } = require('./database/setup');
    setup();
    console.log('✅ Database ready');
} catch (e) {
    console.error('❌ Database setup error:', e.message);
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Trinix ERP API', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/rfqs', require('./routes/rfqs'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/boms', require('./routes/boms'));
app.use('/api/work-orders', require('./routes/workOrders'));
app.use('/api/machines', require('./routes/machines'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/finished-goods', require('./routes/finishedGoods'));
app.use('/api/reports', require('./routes/reports'));

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Trinix ERP Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
