import sys
import os

# Ensure the backend folder is discoverable by Python
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Nirva', 'safewalk-backend'))
if backend_path not in sys.path:
    sys.path.append(backend_path)

# Import the FastAPI app instance for Vercel
from main import app
