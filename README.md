# 🤖 TheAITherapist: Emotion-Aware Conversational LLM Agent

An emotion-aware conversational LLM agent built with long-term affective memory and persistent emotional context tracking across multi-turn, multilingual, and code-switched (**Hinglish**) conversations.

---

## 🚀 Features

* **Affective Memory:** Implements a persistent emotional context tracking system across multi-turn dialogues.
* **Multilingual & Code-Switched Support:** Seamlessly handles inputs in English, Hindi, and mixed **Hinglish** (Hindi-English) formats.
* **Consistency Architecture:** Features experimental frameworks comparing conversational emotional consistency with and without an active memory module.
* **Lightweight & Fast:** Powered by an optimized backend structure and local database persistence.

---

## 🛠️ Tech Stack

| Component | Technology Used |
| :--- | :--- |
| **Frontend** | React.js, Axios |
| **Backend** | Node.js, Express.js, Dotenv |
| **Database** | SQLite |
| **AI / NLP** | Google Gemini API, Hinglish NLP |

---

## 📂 Project Structure

```text
├── backend/          # Express server, SQLite configuration, and Gemini API integration
├── frontend/         # React client components and UI layout
├── nlp/              # Custom processing modules for Hinglish/Code-switched data
└── README.md         # Documentation
