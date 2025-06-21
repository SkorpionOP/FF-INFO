const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigin = 'https://skorpionop.github.io';

app.use(cors());

app.use(express.json());

const EXTERNAL_PLAYER_INFO_API_BASE = 'https://ariiflexlabs-playerinfo-icxc.onrender.com';
const EXTERNAL_IMAGE_API_BASE = 'https://freefireinfo.vercel.app/icon';

app.get('/api/ff/data', async (req, res) => {
    const { uid, region } = req.query;

    if (!uid || !region) {
        return res.status(400).json({ error: 'UID and region parameters are required.' });
    }

    try {
        const externalApiUrl = `${EXTERNAL_PLAYER_INFO_API_BASE}/ff_info?uid=${uid}&region=${region}`;

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
                        reject({ statusCode: apiRes.statusCode, data: data });
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error fetching player data from external API:', error.message || error.details || error);
        if (error.statusCode) {
            try {
                res.status(error.statusCode).json(JSON.parse(error.data));
            } catch (e) {
                res.status(error.statusCode).send(error.data);
            }
        } else {
            res.status(500).json({ error: 'Failed to fetch player data.', details: error.message || 'Unknown error' });
        }
    }
});

app.get('/api/ff/images', async (req, res) => {
    const { iconName } = req.query;

    if (!iconName) {
        return res.status(400).json({ error: 'iconName parameter is required for image fetching.' });
    }

    try {
        const id = iconName.replace(/\.png$/i, '');

        // UPDATED: Construct the URL with '?id=' as the parameter
        const externalApiUrl = `${EXTERNAL_IMAGE_API_BASE}?id=${id}`;

        const response = await axios.get(externalApiUrl, {
            responseType: 'arraybuffer'
        });

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);

    } catch (error) {
        console.error('Error fetching image from external API:', error.message);
        if (error.response) {
            if (error.response.headers['content-type'] && error.response.headers['content-type'].includes('application/json')) {
                const errorJson = JSON.parse(Buffer.from(error.response.data).toString('utf8'));
                res.status(error.response.status).json(errorJson);
            } else {
                res.status(error.response.status).send('Failed to fetch image from external API.');
            }
        } else {
            res.status(500).json({ error: 'Failed to fetch image.', details: error.message });
        }
    }
});

app.get('/', (req, res) => {
    res.send('Free Fire Player Info Proxy Server is running. Use /api/ff/data or /api/ff/images endpoints.');
});

app.listen(PORT, () => {
    console.log(`Proxy server listening at http://localhost:${PORT}`);
});
