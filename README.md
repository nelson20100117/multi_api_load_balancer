# Gemini Multi-API Load Balancer & Proxy

A resilient, secure, and production-ready Express.js reverse proxy and load balancer for rotation, failover, and latency optimization of Google Gemini API keys. It intercepts standard Gemini API calls, routes them across multiple backend keys using either **Priority-Ordered** or **Minimum Latency** strategies, and automatically falls back to alternative keys if rate limits or errors are encountered.

Includes a beautiful, glassmorphic dashboard split into four dedicated operational sections for live tracking, real-time performance analytics, interactive testing, and settings configuration.

---

## 🚀 Key Features

* **Advanced Routing Strategies**:
  * **Priority-Ordered (Sequential)**: Rotates through keys sequentially from top to bottom.
  * **Minimum Latency (Performance-Based)**: Measures connection response times and automatically routes client prompts to the fastest healthy key first.
* **Resilient Failover Engine**: If a backend key fails (due to rate limits, quota limits, network timeouts, or invalid keys), the request transparently attempts fallback keys in sequence without affecting your client application.
* **Standard-Compliant API Proxy**: Mirrors standard Gemini API endpoints (`generateContent` and `streamGenerateContent`). Supports drop-in replacements for SDKs by updating the base URL.
* **Upstream GET Models Proxying**: Intercepts and routes standard `GET /v1beta/models` and `GET /v1beta/models/:model` calls, supporting standard Google Gen AI SDK initialization steps.
* **Beautiful 4-Tab Web Dashboard**:
  * **🏠 Home Tab**: Central operations panel displaying system-wide ratios (active vs healthy keys), live success rates, a read-only Key Health Status Board, and the scrollable Live Routing Logs console.
  * **💻 Playground Tab**: Fully interactive prompt testing console with model selection, route target override selection (direct key routing), response stream renderer, and a step-by-step routing sequence visualizer.
  * **📈 Analytics Tab**: Interactive performance graphs (total traffic, success/failure rate lines, average response latency summary panels) plus the new **Health Check Trends** line chart and scrollable **Health Check Sheet** table.
  * **⚙️ Settings Tab**: Administrative panel supporting drag-to-reorder key configurations, enable/disable toggle switches, manual and batch latency connection tests, client access key controls, routing strategy options, and background scheduler settings.
* **Automated Latency Testing Scheduler**: Periodically tests all configured, enabled keys in the background (intervals: 1m, 5m, 15m, 30m, 1h) using the lightweight `gemini-3.1-flash-lite` model.
* **Persistent Health Logs**: Saves background and manual health check results to `ping_history.json` to survive server restarts, keeping metrics separate from `logs.json` to prevent skewing user request statistics.

---

## 🛠️ Tech Stack

* **Backend**: Node.js (Express.js)
* **Real-time Event Streaming**: Server-Sent Events (SSE) for log updates and settings updates
* **Frontend**: HTML5, Vanilla CSS (Premium Glassmorphism Design, Glow Orbs, animations), Vanilla JavaScript
* **Analytics**: Chart.js for rolling performance and health latency graphs
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
   *Note: On first startup, the server automatically copies the configuration template `config.example.json` to create `config.json`.*

---

## 🖥️ Dashboard Configuration

Once the server is running, open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

1. **Authenticate**: Log in using the default dashboard password: `admin`.
2. **Access Control**: Customize the **Client Access Key** (default: `apikey`) and update the **Dashboard Password** to secure your interface.
3. **Add Gemini Keys**: Add your Gemini API keys, label them (e.g., `Prod Primary`, `Fallback Key 1`), and click **Save Key Configuration**.
4. **Select Strategy**: Choose between **Priority-Ordered** or **Minimum Latency** routing to determine how traffic is distributed.
5. **Background Testing**: Enable **Auto-Ping** and select your desired interval to keep latency stats fresh automatically in the background.

---

## 🔌 API Proxy Usage (Client Applications)

To use the load balancer in your applications, replace the official Google Gemini endpoint `https://generativelanguage.googleapis.com` with your local load balancer address `http://localhost:3000`.

Pass your configured **Client Access Key** inside the `x-goog-api-key` header or as a `key` query parameter.

### 1. Using cURL (Non-Streaming prompt)

```bash
curl -X POST "http://localhost:3000/v1beta/models/gemini-3.1-flash-lite:generateContent?key=apikey" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Explain quantum computing in one sentence."}]
    }]
  }'
```

### 2. Using cURL (Streaming prompt)

```bash
curl -X POST "http://localhost:3000/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?key=apikey" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Write a short story about an AI."}]
    }]
  }'
```

### 3. Using cURL (List Models GET)

```bash
curl "http://localhost:3000/v1beta/models?key=apikey"
```

### 4. Node.js Integration (Official SDK)

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
* **Access Isolation**: Standard clients only require the `clientAccessKey` (which you distribute to applications). Only administrators with the `dashboardPassword` can view logs, delete history, or configure credentials.
