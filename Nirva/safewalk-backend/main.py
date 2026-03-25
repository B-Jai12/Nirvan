# ─────────────────────────────────────────
# main.py
# SafeWalk Consolidated Backend
# 🛡️ Groq Whisper v3 + Llama 3 — All-in-one
# ─────────────────────────────────────────

from typing import Optional, List, Dict, Any
from functools import lru_cache
from fastapi import FastAPI # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from pydantic import BaseModel # type: ignore
from pydantic_settings import BaseSettings, SettingsConfigDict # type: ignore
import uvicorn # type: ignore
import httpx # type: ignore
import time

# Global state for SMS throttling
last_sms_time = 0.0
SMS_COOLDOWN = 60.0 # seconds

# Import specialized agents
from agents.audio_agent import AudioThreatDetector # type: ignore
from agents.movement_pattern import VisionThreatDetector # type: ignore
from agents.location_agent import LocationAnomalyDetector # type: ignore
from agents.false_alarm_filter import FalseAlarmFilterAgent # type: ignore

# Global Latest Results Buffer
latest_results: Dict[str, Any] = {
    "audio": {"confidence": 0.0, "is_threat": False, "transcription": ""},
    "movement": {"confidence": 0.0, "is_threat": False},
    "location": {"confidence": 0.0, "is_threat": False}
}

# ── 1. Configuration ──────────────────────────────────────────────────────────

class Settings(BaseSettings):
    groq_api_key: str = ""
    app_port: int = 8000
    audio_confidence_threshold: float = 0.65
    
    # Twilio (Active Response)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    emergency_contact_number: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings():
    return Settings()

# ── 2. Initialize Agent ───────────────────────────────────────────────────────

settings = get_settings()
audio_agent = AudioThreatDetector(
    api_key=settings.groq_api_key, 
    threshold=settings.audio_confidence_threshold
)
vision_agent = VisionThreatDetector(settings.groq_api_key)
location_agent = LocationAnomalyDetector(settings.groq_api_key)
filter_agent = FalseAlarmFilterAgent(settings.groq_api_key)

# ── 3. Models ─────────────────────────────────────────────────────────────────

class AudioAnalyseRequest(BaseModel):
    audio_b64: str
    mime_type: Optional[str] = "audio/webm"

class VisionAnalyseRequest(BaseModel):
    image_b64: str

class LocationAnalyseRequest(BaseModel):
    history: List[Dict]
    current_lat: float
    current_lon: float

# ── 4. FastAPI App ────────────────────────────────────────────────────────────

app = FastAPI(title="SafeWalk Audio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 5. Helper Logic ───────────────────────────────────────────────────────────

async def send_emergency_sms(transcription: str, confidence: float) -> bool:
    """Sends a high-priority SMS via Twilio API with a cooldown."""
    global last_sms_time
    current_time = time.time()
    
    if current_time - last_sms_time < SMS_COOLDOWN:
        remaining = int(SMS_COOLDOWN - (current_time - last_sms_time))
        print(f"⏳ SMS Cooldown: Skipping dispatch (next available in {remaining}s)")
        return False

    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        print(f"⚠️ SIMULATED EMERGENCY SMS (Missing Credentials): 'SafeWalk Alert! Transcription: {transcription}'")
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    auth = (settings.twilio_account_sid, settings.twilio_auth_token)
    payload = {
        "From": settings.twilio_from_number,
        "To": settings.emergency_contact_number,
        "Body": f"🚨 SafeWalk EMERGENCY ALERT!\nThreat detected with {confidence*100}% confidence.\nTranscription: '{transcription}'"
    }
    
    print(f"📡 Sending TWILIO SMS to {settings.emergency_contact_number} via SID {settings.twilio_account_sid}...")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.post(url, data=payload, auth=auth)
            if r.status_code != 201:
                print(f"❌ Twilio Error ({r.status_code}): {r.text}")
                return False
            else:
                last_sms_time = time.time() 
                print("✅ Emergency SMS dispatched successfully via Twilio.")
                return True
        except Exception as e:
            print(f"❌ Network/Request Failure during SMS: {e}")
            return False
    return False # Final fallback

# ── 6. Routes ──────────────────────────────────────────────────────────────────
def root():
    return {"status": "online", "agent": "Audio Threat Detector", "engine": "Groq LPU"}

@app.post("/api/v1/audio/analyse")
async def analyse_audio(request: AudioAnalyseRequest):
    global latest_results
    print(f"📥 Received Audio: {len(request.audio_b64)} chars | MIME: {request.mime_type}")
    result = await audio_agent.analyse(request.audio_b64, request.mime_type)
    
    # Store in shared sensor buffer
    latest_results["audio"] = {"confidence": result.confidence, "is_threat": result.is_threat, "transcription": getattr(result, 'transcription', '')}

    # Run filter agent after audio update
    filter_decision = await filter_agent.decide(
        latest_results["audio"],
        latest_results["movement"],
        latest_results["location"]
    )

    # Trigger SMS only if filter says ESCALATE
    sms_triggered = False
    if filter_decision.escalate:
        sms_triggered = True
        print(f"🚨 FILTER ESCALATED: {filter_decision.decision} | Confidence: {filter_decision.final_confidence:.0%}")
        # Await the SMS instead of background task to catch errors
        success = await send_emergency_sms(latest_results["audio"].get("transcription", ""), filter_decision.final_confidence)
    else:
        print(f"✅ FILTER DISMISSED: {filter_decision.dismissal_reason}")

    return {
        "success": True,
        "result": result.model_dump(),
        "filter": filter_decision.model_dump(),
        "sms_triggered": sms_triggered,
        "message": "Audio analysis complete"
    }

@app.post("/api/v1/vision/analyse")
async def analyse_vision(request: VisionAnalyseRequest):
    global latest_results
    result = await vision_agent.analyse(request.image_b64)

    # Store in shared sensor buffer
    latest_results["movement"] = {"confidence": result.confidence, "is_threat": result.is_threat}

    # Run filter agent after vision update
    filter_decision = await filter_agent.decide(
        latest_results["audio"],
        latest_results["movement"],
        latest_results["location"]
    )

    return {
        "success": True,
        "result": result.model_dump(),
        "filter": filter_decision.model_dump(),
        "message": "Vision analysis complete"
    }

@app.post("/api/v1/location/analyse")
async def analyse_location(request: LocationAnalyseRequest):
    global latest_results
    result = await location_agent.analyse(request.history, request.current_lat, request.current_lon)

    # Store in shared sensor buffer
    latest_results["location"] = {"confidence": result.confidence, "is_threat": result.is_threat}

    # Run filter agent after location update
    filter_decision = await filter_agent.decide(
        latest_results["audio"],
        latest_results["movement"],
        latest_results["location"]
    )

    return {
        "success": True,
        "result": result.model_dump(),
        "filter": filter_decision.model_dump(),
        "message": "Location analysis complete"
    }

@app.get("/api/v1/filter/status")
async def filter_status():
    """Returns the current sensor buffer state and a live filter decision."""
    filter_decision = await filter_agent.decide(
        latest_results["audio"],
        latest_results["movement"],
        latest_results["location"]
    )
    return {
        "success": True,
        "sensor_buffer": latest_results,
        "filter": filter_decision.model_dump()
    }

@app.get("/api/v1/audio/health")
def health():
    return {"status": "ready", "key_configured": bool(get_settings().groq_api_key)}

# ── 5. Run ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=False)
