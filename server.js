const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const db = new sqlite3.Database("./repos.db");

db.run("CREATE TABLE IF NOT EXISTS repositories (url TEXT, last_commit TEXT)");

app.use(express.json());

// Add a repo to track
app.post("/add-repo", (req, res) => {
    const { repoUrl } = req.body;
    db.run("INSERT INTO repositories (url, last_commit) VALUES (?, '')", [repoUrl], (err) => {
        if (err) return res.status(500).send("Error adding repo.");
        res.send("Repo added!");
    });
});

// Check for updates
async function checkForUpdates() {
    db.all("SELECT * FROM repositories", async (err, repos) => {
        if (err) return console.error(err);

        for (let repo of repos) {
            const apiUrl = repo.url.replace("github.com", "api.github.com/repos") + "/commits";
            try {
                const response = await axios.get(apiUrl);
                const latestCommit = response.data[0].sha;

                if (repo.last_commit && repo.last_commit !== latestCommit) {
                    sendEmailNotification(repo.url, latestCommit);
                    db.run("UPDATE repositories SET last_commit = ? WHERE url = ?", [latestCommit, repo.url]);
                } else {
                    db.run("UPDATE repositories SET last_commit = ? WHERE url = ? AND last_commit = ''", [latestCommit, repo.url]);
                }
            } catch (error) {
                console.error("Error checking repo:", repo.url, error.message);
            }
        }
    });
}

// Send email notification
function sendEmailNotification(repoUrl, commitSha) {
    let transporter = nodemailer.createTransport({
        service: "epitech",
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASS,
        },
    });

    let mailOptions = {
        from: process.env.EMAIL,
        to: process.env.EMAIL,
        subject: `New push in ${repoUrl}`,
        text: `New commit: ${commitSha} in ${repoUrl}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error("Email error:", error);
        else console.log("Email sent:", info.response);
    });
}

// Run update check every 5 minutes
setInterval(checkForUpdates, 5 * 60 * 1000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
