import dotenv from "dotenv";
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);
}

const MODEL_ORDER = ["gemini-2.5-flash", "gemini-1.5-flash"];
async function callGeminiAPI(prompt, attempt = 0) {
  try {
    const modelName = MODEL_ORDER[attempt] || MODEL_ORDER[0];

    console.log(`Calling Gemini model: ${modelName}`);

    const response = await withTimeout(
      ai.models.generateContent({
        model: modelName,
        contents: prompt
      }),
      10000
    );
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    if ((error.status === 503 || error.message === "timeout") && attempt < MODEL_ORDER.length - 1) {
      console.log("Model overloaded. Trying fallback...");
      await new Promise(r => setTimeout(r, 1500));
      return callGeminiAPI(prompt, attempt + 1);
    }
    return "Server thoda busy hai… please try again!";
  }
}
const dbPath = path.join(__dirname, 'data', 'Shreya_database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      sender TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      emotion TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance TEXT DEFAULT 'medium',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      access_count INTEGER DEFAULT 0,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT DEFAULT 'Friend',
      message_count INTEGER DEFAULT 0,
      days_active INTEGER DEFAULT 0,
      first_message_date DATETIME,
      last_message_date DATETIME
    )
  `);
  db.run(`
    INSERT OR IGNORE INTO user_profile (id, name, message_count, days_active)
    VALUES (1, 'Friend', 0, 0)
  `);

  console.log('Database tables initialized successfully.');
}

function detectEmotion(text) {
  const lower = text.toLowerCase();
  const emotions = {
    sad: ['sad', 'depressed', 'down', 'dukhi', 'udaas'],
    happy: ['happy', 'great', 'awesome', 'khush'],
    angry: ['angry', 'frustrated', 'gussa'],
    anxious: ['anxious', 'worried', 'pareshaan'],
    tired: ['tired', 'thaka', 'neend']
  };
  for (const [emotion, words] of Object.entries(emotions)) {
    if (words.some(w => lower.includes(w))) return emotion;
  }
  return 'neutral';
}

function getRelevantMemories(cb) {
  db.all(`
    SELECT * FROM memories
    ORDER BY importance DESC, access_count DESC, last_accessed DESC
    LIMIT 5
  `, cb);
}

app.post('/api/chat', (req, res) => {
  const { message, conversationHistory } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  const userEmotion = detectEmotion(message);
  getRelevantMemories(async (err, memories = []) => {
    if (err) console.error("Memory fetch error:", err);
    const memoryContext = memories.length
      ? `\nMEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}`
      : '';
    const historyContext = conversationHistory?.length
      ? `\nHISTORY:\n${conversationHistory.slice(-3).map(m => `${m.sender}: ${m.text}`).join('\n')}`
      : '';
    const prompt = `
      You are Shreya, a warm Hinglish AI friend.
      Reply in short (2-3 lines). Be supportive and casual.

      User emotion: ${userEmotion}
      ${memoryContext}
      ${historyContext}

      User: ${message}
          `;
    try {
      const reply = await callGeminiAPI(prompt);
      const shreyaEmotion = detectEmotion(reply);
      db.run(
        `INSERT INTO conversations (message, response, sender, emotion)
         VALUES (?, '', 'user', ?)`,
        [message, userEmotion]
      );
      db.run(
        `INSERT INTO conversations (message, response, sender, emotion)
         VALUES ('', ?, 'Shreya', ?)`,
        [reply, shreyaEmotion]
      );
      res.json({ response: reply, emotion: shreyaEmotion });
    } catch (e) {
      console.error("Chat route error:", e);
      res.json({
        response: "Sorry yaar, kuch problem aa gaya… try again?",
        emotion: "neutral"
      });
    }
  });
});

app.get('/api/health', (_, res) => {
  res.json({
    status: 'healthy',
    gemini: process.env.GEMINI_API_KEY ? "configured" : "missing"
  });
});

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

process.on('SIGINT', () => {
  console.log('\nClosing SQLite DB...');
  db.close(() => process.exit(0));
});

app.listen(PORT, () => {
  console.log(`Shreya AI running at http://localhost:${PORT}`);
});
