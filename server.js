const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

const { exec } = require('child_process');

const multer = require('multer');

// Parse incoming JSON requests
app.use(express.json());

// Serve static files (e.g., HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Folder where files will be saved
const filesDir = path.join(__dirname, 'files');
const mapsDir = path.join(__dirname, 'maps'); // Define upload directory

// Ensure the 'files' directory exists
if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mapsDir);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const timestamp = now.getFullYear().toString() + 
                          String(now.getMonth() + 1).padStart(2, '0') + 
                          String(now.getDate()).padStart(2, '0') + "_" + 
                          String(now.getHours()).padStart(2, '0') + 
                          String(now.getMinutes()).padStart(2, '0') + 
                          String(now.getSeconds()).padStart(2, '0');

        const ext = path.extname(file.originalname); // Get file extension
        cb(null, `${timestamp}${ext}`); // Format: yyyymmdd_hhmmss.ext
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed!'), false);
        }
    }
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    const uploadedFilePath = path.join(mapsDir, req.file.filename);
    const outputFilePath = path.join(mapsDir, `${req.file.filename.split('.')[0]}.png`);

    
    res.json({ success: true, mapFile: '/maps/' + req.file.filename, scaled: false });
});

//check if file exists
app.get('/file-exists/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'files', filename);  // Ensure this is the correct path

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.json({ exists: false });
        } else {
            return res.json({ exists: true });
        }
    });
});

app.get('/get-files', (req, res) => {
    fs.readdir(filesDir, (err, files) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading files' });
        }

        // Get metadata for each file, including the number of cP entries
        const fileMetadataPromises = files.map(file => {
            const filePath = path.join(filesDir, file);
            return new Promise((resolve, reject) => {
                // Read the file content to get cP length
                fs.readFile(filePath, 'utf-8', (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        try {
                            const fileContent = JSON.parse(data);

                            // Get the number of cP entries
                            const cPCount = Array.isArray(fileContent.cP) ? fileContent.cP.length : 0;

                            // Get file metadata (modified time, etc.)
                            fs.stat(filePath, (err, stats) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({
                                        filename: file,
                                        modified: stats.mtime.toISOString(), // Ensure it's a valid ISO date string
                                        cPCount: cPCount, // Include the count of cP entries
                                    });
                                }
                            });
                        } catch (parseError) {
                            reject(parseError); // Handle JSON parse errors
                        }
                    }
                });
            });
        });

        // Resolve all promises and send metadata
        Promise.all(fileMetadataPromises)
            .then(metadata => {
                res.json(metadata); // Send file metadata with cP count
            })
            .catch(err => {
                res.status(500).json({ message: 'Error getting file metadata', error: err.message });
            });
    });
});

// Route to save a file
app.post('/save-file', (req, res) => {
    const { filename, data } = req.body;
    const filePath = path.join(filesDir, filename);

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error saving the file' });
        }
        res.json({ message: 'File saved successfully!' });
    });
});

app.use('/maps', express.static('maps'));

// Route to delete a file
app.delete('/delete-file/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(filesDir, filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error deleting the file' });
        }
        res.json({ message: 'File deleted successfully!' });
    });
});

// Route to load a file (you can modify as needed)
app.get('/load-file/:filename', (req, res) => {
    const filePath = path.join(filesDir, req.params.filename);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Error loading file' });
        }
        res.json(JSON.parse(data)); // Assuming the file content is JSON
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});