const express = require("express");
const multer = require("multer");
const cors = require("cors");
const docxToPDF = require("docx-pdf");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { randomUUID } = require("crypto");

const app = express();
const port = 3000;

app.use(cors());

app.get("/", (req, res) => {
    res.json({
        message: "DOCX to PDF API is running",
        endpoint: "POST /convertFile",
    });
});

// Vercel only allows writes to the temporary directory.
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, os.tmpdir());
    },
    filename: function(req, file, cb) {
        cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage: storage });
const cleanupTemporaryFiles = (...filePaths) => {
    for (const filePath of filePaths) {
        fs.unlink(filePath, (error) => {
            if (error && error.code !== "ENOENT") {
                console.error("Failed to remove temporary file:", error);
            }
        });
    }
};

app.post("/convertFile", upload.single("file"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded",
            });
        }
        const outputPath = `${req.file.path}.pdf`;
        const originalName = path.basename(req.file.originalname.replace(/\\/g, "/"));
        const downloadName = `${path.parse(originalName).name}.pdf`;

        docxToPDF(req.file.path, outputPath, (err) => {
            if (err) {
                console.error("Error converting DOCX to PDF:", err);
                cleanupTemporaryFiles(req.file.path, outputPath);
                return res.status(500).json({
                    message: "Error converting docx to pdf",
                });
            }
            res.download(outputPath, downloadName, (downloadError) => {
                cleanupTemporaryFiles(req.file.path, outputPath);
                if (downloadError && !res.headersSent) {
                    console.error("Error sending converted PDF:", downloadError);
                    res.status(500).json({
                        message: "Error sending converted PDF",
                    });
                }
            });
        });
    } catch (error) {
        console.error("Error converting DOCX to PDF:", error);
        if (req.file) {
            cleanupTemporaryFiles(req.file.path, `${req.file.path}.pdf`);
        }
        res.status(500).json({
            message: "Internal server error",
        });
    }
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is listening on port ${port}`);
    });
}

module.exports = app;
