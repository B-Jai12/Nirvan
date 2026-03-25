---
description: How to run the SafeWalk Backend project
---

To run the entire project, you need to start the **Backend Server** (to handle API requests) and the **Developer Dashboard** (to interact with the agents).

### 1. Backend API (FastAPI)
The backend manages the agents (Audio, Movement, Location, Filter) and exposes the endpoints.

1.  Open a terminal in the project root.
2.  Activate the virtual environment:
    ```powershell
    .\venv\Scripts\activate
    ```
3.  Start the FastAPI server:
    ```powershell
    python main.py
    ```
    *The server will be live at `http://localhost:8000`.*

### 2. Developer Dashboard (Streamlit)
The dashboard provides a visual interface to test the agents manually.

1.  Open a **second** terminal.
2.  Activate the virtual environment:
    ```powershell
    .\venv\Scripts\activate
    ```
3.  Start the dashboard:
    ```powershell
    streamlit run dashboard.py
    ```
    *This will open a new tab in your browser at `http://localhost:8501`.*

### 3. (Optional) Standalone Audio Tester
If you only want to test the Audio Agent specifically:
```powershell
streamlit run audio_tester.py
```

> [!NOTE]
> Make sure your `.env` file contains your **GROQ_API_KEY**.
