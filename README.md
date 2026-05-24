# Gemini Multi-API Load Balancer & Proxy

A resilient, secure, and production-ready Express.js reverse proxy and load balancer for rotation and failover of Google Gemini API keys. It intercepts all standard Gemini API calls, routes them across a priority-based list of API keys, and automatically falls back to alternative keys if rate limits or errors are encountered.

Included is a beautiful, modern dashboard for live key status tracking, real-time routing console logs, and request/response playgrounds.

---

## 🚀 Key Features

* **Sequential Key Rotation**: Custom priority-ordered key routing.
* **Resilient Failover Engine**: If one API key fails (due to rate limits, quota issues, network timeouts, or invalid keys), the request automatically attempts the next priority key transparently without affecting the client application.
* **Interactive Web Dashboard**:
  - Secure login access page.
  - Add, remove, and reorder API keys dynamically.
  - Monitor health status, success counts, and error rates of each key.
* **Live Server Logs**: Real-time log streaming of proxy events using Server-Sent Events (SSE).
* **Built-in API Playground**: Test prompt execution with streaming and non-streaming responses.
* **Standard-Compliant API Proxy**: Mirrors standard Gemini API endpoints (`generateContent` and `streamGenerateContent`). Supports drop-in replacements for SDKs by updating the base URL.

---

## 🛠️ Tech Stack

* **Backend**: Node.js, Express.js
* **Real-time Event Streaming**: SSE (Server-Sent Events)
* **Frontend**: HTML5, Vanilla CSS (Premium Glassmorphism Design, Glow Orbs, animations), Vanilla JavaScript
* **Authentication**: Token-based authentication for administrative dashboard

---

## 📦 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
* One or more [Google Gemini API Keys](https://ai.google.dev/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nelson20100117/multi_api_load_balancer.git
   cd multi_api_load_balancer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the server:
   ```bash
   npm start
   ```
   *Note: On first startup, the server will automatically copy the configuration template `config.example.json` to create `config.json`.*

---

## 🖥️ Dashboard Configuration

Once the server is running, open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

1. **Authenticate**: Log in using the default dashboard password: `admin`.
2. **Access Control**: Customize the **Client Access Key** (default: `apikey`) and update the **Dashboard Password** to secure your interface.
3. **Add Gemini Keys**: Add your Gemini API keys, label them (e.g., `Prod Primary`, `Fallback Key 1`), and click **Save Key Configuration**.
4. **Reorder & Priorities**: Keys are selected sequentially from top to bottom. Drag or use the arrows to adjust order.

---

## 🔌 API Usage (Client Applications)

To use the load balancer in your applications, replace the official Google Gemini endpoint `https://generativelanguage.googleapis.com` with your local load balancer address `http://localhost:3000`.

Pass your configured **Client Access Key** (set in your Access Control panel) inside the `x-goog-api-key` header or as a `key` query parameter.

### 1. Using cURL (Non-Streaming)

```bash
curl -X POST "http://localhost:3000/v1beta/models/gemini-3.1-flash-lite:generateContent?key=apikey" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Explain quantum computing in one sentence."}]
    }]
  }'
```

### 2. Using cURL (Streaming)

```bash
curl -X POST "http://localhost:3000/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?key=apikey" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Write a short story about an AI."}]
    }]
  }'
```

### 3. Node.js Integration (Official SDK)

You can easily route the official `@google/genai` library by modifying the API base path/endpoint configurations:

```javascript
import { GoogleGenAI } from '@google/genai';

// Initialize SDK pointing to your local load balancer
const ai = new GoogleGenAI({
  apiKey: 'apikey', // Your Client Access Key
  baseURL: 'http://localhost:3000/v1beta' // Your proxy base
});

const response = await ai.models.generateContent({
  model: 'gemini-3.1-flash-lite',
  contents: 'Explain the theory of relativity to a 10 year old.',
});

console.log(response.text);
```

---

## 🔒 Security & Secrets Management

* **Secret Protection**: Your Gemini keys are stored locally in `config.json` and are **never** shared with third parties or sent over the internet outside of official Google endpoint requests.
* **Access Isolation**: Standard clients only require the `clientAccessKey` (which you distribute to applications). Only administrators with the `dashboardPassword` can view logs or configure credentials.
