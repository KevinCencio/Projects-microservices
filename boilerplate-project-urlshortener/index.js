require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// Data storage for URLs
const urlDatabase = new Map();
let urlCounter = 1;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

/**
 * Parses and validates a url string to a URL object.
 * Returns null if invalid.
 * @param {string} urlString
 * @returns {Promise<URL|null>}
 */
function parseUrl(urlString) {
  return new Promise((resolve) => {
    try {
      // Add protocol if missing
      if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        urlString = 'https://' + urlString;
      }
      
      const parsedUrl = new URL(urlString);
      
      // Validate URL format
      if (!parsedUrl.hostname) {
        resolve(null);
        return;
      }
      
      // Check if hostname is valid via DNS lookup
      dns.lookup(parsedUrl.hostname, (err) => {
        if (err) {
          resolve(null);
        } else {
          resolve(parsedUrl);
        }
      });
    } catch (error) {
      resolve(null);
    }
  });
}

/**
 * Take a valid long URL and return the short url
 * @param {URL} url
 * @returns {number}
 */
function getShortUrl(url) {
  const urlString = url.toString();
  
  // Check if URL already exists in database
  for (let [id, storedUrl] of urlDatabase) {
    if (storedUrl === urlString) {
      return parseInt(id);
    }
  }
  
  // Create new short URL
  const shortUrl = urlCounter;
  urlDatabase.set(shortUrl.toString(), urlString);
  urlCounter++;
  
  return shortUrl;
}

// GET endpoint to redirect short URLs
app.get("/api/shorturl/:short_url", (req, res) => {
  const shortUrl = req.params.short_url;
  const originalUrl = urlDatabase.get(shortUrl);
  
  if (originalUrl) {
    res.redirect(originalUrl);
  } else {
    res.status(404).json({ error: "No short URL found for the given input" });
  }
});

// POST endpoint to create short URLs
app.post("/api/shorturl", async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.json({ error: "invalid url" });
  }
  
  const parsedUrl = await parseUrl(url);
  
  if (parsedUrl) {
    const shortUrl = getShortUrl(parsedUrl);
    res.json({ 
      original_url: parsedUrl.toString(), 
      short_url: shortUrl 
    });
  } else {
    res.json({ error: "invalid url" });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});