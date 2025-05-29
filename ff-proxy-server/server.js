// Import necessary modules
const express = require('express');
const axios = require('axios'); // Still needed for image proxy
const cors = require('cors');
const https = require('https'); // Node.js built-in HTTPS module

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable for port or default to 3000

// Enable CORS for all routes to allow frontend access
app.use(cors());

// Middleware to parse JSON bodies (useful if you expand to POST requests later)
app.use(express.json());

// --- Define the actual external API base URLs ---
const EXTERNAL_PLAYER_INFO_API_BASE = 'https://ariiflexlabs-playerinfo-icxc.onrender.com';
const EXTERNAL_IMAGE_API_BASE = 'https://system.ffgarena.cloud/api/iconsff';
// -------------------------------------------------

// Proxy route for fetching Player Information
// This endpoint will be called by your frontend: http://localhost:3000/api/ff/data?uid=...&region=...
app.get('/api/ff/data', async (req, res) => {
    const { uid, region } = req.query;

    // Basic validation for required parameters
    if (!uid || !region) {
        return res.status(400).json({ error: 'UID and region parameters are required.' });
    }

    try {
        // Construct the URL for the external player info API
        const externalApiUrl = `${EXTERNAL_PLAYER_INFO_API_BASE}/ff_info?uid=${uid}&region=${region}`;

        // Use Node.js's built-in https module for server-to-server call
        const responseData = await new Promise((resolve, reject) => {
            https.get(externalApiUrl, (apiRes) => {
                let data = '';
                apiRes.on('data', (chunk) => {
                    data += chunk;
                });
                apiRes.on('end', () => {
                    if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Failed to parse JSON response from external API.'));
                        }
                    } else {
                        // Forward the status code and data from the external API
                        reject({ statusCode: apiRes.statusCode, data: data });
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });

        // Forward the response data from the external API to the frontend
        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error fetching player data from external API:', error.message || error.details || error);
        if (error.statusCode) {
            // If the external API responded with an HTTP error, forward its status and data
            try {
                res.status(error.statusCode).json(JSON.parse(error.data));
            } catch (e) {
                res.status(error.statusCode).send(error.data); // Send raw data if not JSON
            }
        } else {
            // Handle network errors or other issues
            res.status(500).json({ error: 'Failed to fetch player data.', details: error.message || 'Unknown error' });
        }
    }
});

// Proxy route for fetching Images (avatars, banners, equipped items)
// This endpoint will be called by your frontend: http://localhost:3000/api/ff/images?iconName=...
app.get('/api/ff/images', async (req, res) => {
    const { iconName } = req.query; // Expecting iconName (e.g., "203000449.png")

    // Basic validation for required parameter
    if (!iconName) {
        return res.status(400).json({ error: 'iconName parameter is required for image fetching.' });
    }

    try {
        // Construct the URL for the external image API
        const externalApiUrl = `${EXTERNAL_IMAGE_API_BASE}`; // Base URL already includes /api/iconsff
        const response = await axios.get(externalApiUrl, {
            params: { image: iconName }, // The external API expects 'image' parameter
            responseType: 'arraybuffer' // Important: tells Axios to expect binary data
        });

        // Set appropriate content type header for the image (e.g., 'image/png')
        // This ensures the browser knows how to render the incoming data
        res.set('Content-Type', response.headers['content-type']);
        // Forward the binary image data directly to the frontend
        res.send(response.data);

    } catch (error) {
        console.error('Error fetching image from external API:', error.message);
        if (error.response) {
            // Attempt to forward the external API's error response.
            // If it's JSON, parse and send as JSON. Otherwise, send generic error.
            if (error.response.headers['content-type'] && error.response.headers['content-type'].includes('application/json')) {
                // Assuming the error response is a JSON string in arraybuffer, convert it back
                const errorJson = JSON.parse(Buffer.from(error.response.data).toString('utf8'));
                res.status(error.response.status).json(errorJson);
            } else {
                res.status(error.response.status).send('Failed to fetch image from external API.');
            }
        } else {
            // Handle network errors or other issues
            res.status(500).json({ error: 'Failed to fetch image.', details: error.message });
        }
    }
});

// Basic root route for testing the proxy server status
app.get('/', (req, res) => {
    res.send('Free Fire Player Info Proxy Server is running. Use /api/ff/data or /api/ff/images endpoints.');
});

// Start the server and listen for incoming requests
app.listen(PORT, () => {
    console.log(`Proxy server listening at http://localhost:${PORT}`);
});
