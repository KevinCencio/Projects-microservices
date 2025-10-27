var express = require('express');
var cors = require('cors');
require('dotenv').config()

var app = express();

app.use(cors());
app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// File upload endpoint without any external packages
app.post('/api/fileanalyse', (req, res) => {
  const contentType = req.headers['content-type'];
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
  }

  const boundary = '--' + contentType.split('boundary=')[1];
  let body = Buffer.alloc(0);

  req.on('data', (chunk) => {
    body = Buffer.concat([body, chunk]);
  });

  req.on('end', () => {
    try {
      // Find the file part by looking for the upfile field
      const fileField = `name="upfile"`;
      const fileFieldIndex = body.indexOf(Buffer.from(fileField));
      
      if (fileFieldIndex === -1) {
        return res.status(400).json({ error: 'No file uploaded or incorrect field name' });
      }

      // Find the filename in the headers
      const filenameMatch = body.toString().match(/filename="([^"]+)"/);
      if (!filenameMatch) {
        return res.status(400).json({ error: 'Could not extract filename' });
      }
      const filename = filenameMatch[1];

      // Find Content-Type
      const contentTypeMatch = body.toString().match(/Content-Type:\s*([^\r\n]+)/);
      const fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

      // Extract file content between boundaries
      const boundaryBuffer = Buffer.from(boundary);
      const boundaries = [];
      let start = 0;
      
      // Find all boundary positions
      while ((start = body.indexOf(boundaryBuffer, start)) !== -1) {
        boundaries.push(start);
        start += boundaryBuffer.length;
      }

      if (boundaries.length < 2) {
        return res.status(400).json({ error: 'Invalid multipart data' });
      }

      // Find the start of file content (after headers)
      const fileStart = body.indexOf(Buffer.from('\r\n\r\n'), fileFieldIndex) + 4;
      if (fileStart === 3) { // +4 -1 = 3 if not found
        return res.status(400).json({ error: 'Could not find file content' });
      }

      // Find the next boundary after file content
      let fileEnd = body.length;
      for (let i = 0; i < boundaries.length; i++) {
        if (boundaries[i] > fileStart) {
          fileEnd = boundaries[i] - 2; // Subtract CRLF before boundary
          break;
        }
      }

      const fileContent = body.slice(fileStart, fileEnd);
      const fileSize = fileContent.length;

      res.json({
        name: filename,
        type: fileType,
        size: fileSize
      });

    } catch (error) {
      res.status(500).json({ error: 'Error processing file upload' });
    }
  });

  req.on('error', (error) => {
    res.status(500).json({ error: 'Error reading request' });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('Your app is listening on port ' + port)
});