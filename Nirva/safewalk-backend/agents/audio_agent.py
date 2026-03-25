# ─────────────────────────────────────────
# agents/audio_agent.py
# SafeWalk — The Audio Agent Module
# 🛡️ Groq Whisper v3 + Llama 3 — All-in-one
# ─────────────────────────────────────────

import json
import httpx # type: ignore
import io
import os
import tempfile
import base64
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

# ── Utilities ────────────────────────────────────────────────────────────────

def decode_base64_audio(b64: str) -> bytes:
    if "," in b64: b64 = b64.split(",", 1)[1]
    return base64.b64decode(b64)

def trim_audio_bytes(audio_bytes: bytes, max_seconds: int = 10, sample_rate: int = 16000) -> bytes:
    """Stage 2: Trim to last N seconds."""
    bytes_per_second = int(sample_rate * 2)
    max_bytes = int(max_seconds * bytes_per_second)
    if len(audio_bytes) <= max_bytes:
        return audio_bytes
    return audio_bytes[-max_bytes:] # type: ignore

# ── Models ───────────────────────────────────────────────────────────────────

@dataclass
class AudioThreatResult:
    confidence: float
    threat_type: str
    keywords_detected: List[str]
    tone: str
    is_threat: bool
    language_detected: str
    raw_analysis: str
    transcription: str

    def model_dump(self) -> dict:
        return {
            "confidence": self.confidence, 
            "threat_type": self.threat_type,
            "keywords_detected": self.keywords_detected, 
            "tone": self.tone,
            "is_threat": self.is_threat, 
            "language_detected": self.language_detected,
            "raw_analysis": self.raw_analysis,
            "transcription": self.transcription
        }

# ── AI Agent Logic ─────────────────────────────────────────────────────────

AUDIO_ANALYSIS_PROMPT = """
You are the Audio Analysis Expert for SafeWalk.
Analyze the transcription for signs of danger.

Models settings: temperature=0.1, max_tokens=400.

### 🛡️ Analysis Rules:
1. **Aggression**: Threatening tone, hostile commands.
2. **Distress Keywords**: ruko, pakdo, bachao, help, chhod do, mat jao, please stop.
3. **Struggle**: Physical confrontation language, muffled screams.
4. **Coercion**: Being forced, followed, cornered.
5. **Smart Filtering**: Be cautious of high-noise environments. If you hear traffic, music, or shouting fans (e.g., sports), look ONLY for human distress triggers. Do not flag loud music or cars as threats.

### 🧠 Temporal Context:
Analyze if the danger is **escalating** based on the provided history. A single "Who are you?" might be safe, but "Who are you?" followed by "Stop following me!" is a THREAT.

Respond ONLY with valid JSON:
{
  "confidence": <float 0.0–1.0>,
  "threat_type": "<aggression|distress_keyword|scream|struggle|coercion|safe>",
  "keywords_detected": ["<word1>"],
  "tone": "<panicked|aggressive|urgent|calm>",
  "language_detected": "<detected language(s)>",
  "raw_analysis": "<1-2 sentence detailed reasoning accounting for noise vs human distress>"
}
"""

class AudioThreatDetector:
    def __init__(self, api_key: str, threshold: float = 0.65):
        self.api_key = api_key
        self.threshold = threshold
        self.history: List[str] = []

    async def analyse(self, b64: str, mime: str = "audio/webm") -> AudioThreatResult:
        """Stage 8: Fail-Safe on every error."""
        try:
            # 1. Decode (Stage 2)
            audio_bytes = decode_base64_audio(b64)
            if len(audio_bytes) < 500: return self._fail("Audio too short")

            # Fix MIME → extension (strip codec qualifiers like ;codecs=opus)
            mime_base = mime.split(";")[0].strip()
            ext_map = {
                "audio/webm": ".webm",
                "audio/ogg": ".ogg",
                "audio/mp4": ".mp4",
                "audio/m4a": ".m4a",
                "audio/wav": ".wav",
                "audio/mpeg": ".mp3",
            }
            ext = ext_map.get(mime_base, ".webm")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            # 2. Transcribe (Stage 3 - Groq Whisper v3)
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=20.0) as client:
                audio_data = {
                    "model": "whisper-large-v3", 
                    "response_format": "json",
                    "temperature": 0.0
                }
                with open(tmp_path, "rb") as f:
                    files = {
                        "file": (os.path.basename(tmp_path), f.read(), mime_base)
                    }
                    r = await client.post(
                        "https://api.groq.com/openai/v1/audio/transcriptions",
                        data=audio_data,
                        files=files,
                        headers=headers
                    )
                    r.raise_for_status()
                    transcription = r.json().get("text", "").strip()
                    print(f"🎙️ Whisper Transcription: '{transcription}'")

            if not transcription or transcription == ".":
                if os.path.exists(tmp_path): os.unlink(tmp_path)
                return self._fail("Silent or unparseable audio")

            # 🛡️ HARD SAFETY BYPASS (The "Perfection" Rule)
            # 1. Greetings and known Whisper silence-hallucinations are ALWAYS safe.
            low_trans = transcription.lower().strip(".,! ")
            SAFE_WORDS = [
                "hi", "hello", "hey", "i am safe", "everything is fine", 
                "thank you", "thanks", "test", "testing",
                "transcribing", "subtitles", "subtitles by", "amara.org", "you"
            ]
            if low_trans in SAFE_WORDS or len(low_trans) < 3:
                print(f"✅ Safety Bypass Triggered for: '{low_trans}'")
                if os.path.exists(tmp_path): os.unlink(tmp_path)
                self.history = []
                return AudioThreatResult(0.01, "safe", [], "calm", False, "en", "User provided a safe greeting.", transcription)

            # 2. DISTRESS is ALWAYS a threat (Overrules AI)
            critical_keywords = ["help", "bachao", "ruko", "pakdo", "chhod do", "emergency", "danger"]
            has_critical = any(word in low_trans for word in critical_keywords)
            
            if has_critical or low_trans.count("stop") >= 2:
                print(f"🚩 Absolute Distress Dominance Triggered: '{low_trans}'")
                if os.path.exists(tmp_path): os.unlink(tmp_path)
                return AudioThreatResult(0.95, "distress_keyword", ["help"], "urgent", True, "auto", "HARD RULE: Critical distress keywords detected. Absolute threat confirmation.", transcription)

            # 3. Analyze (Stage 4 - Groq Llama 3.3 70B for Complex Context)
            # Maintain history (max 3 cycles)
            context = "\n".join([f"Previous: {h}" for h in self.history])
            self.history.append(transcription)
            if len(self.history) > 3: self.history.pop(0)

            user_content = f"CONTEXTUAL HISTORY:\n{context}\n\nCURRENT TRANSCRIPTION: '{transcription}'\n\n{AUDIO_ANALYSIS_PROMPT}"
            
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You are a high-fidelity security analyzer. If a message contains both a greeting and a distress signal (e.g. 'hello, help me'), it is ALWAYS a threat. Only use low confidence (<0.10) if the message is PURELY safe."},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"}
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
                r.raise_for_status()
                analysis = json.loads(r.json()["choices"][0]["message"]["content"])
            
            if os.path.exists(tmp_path): os.unlink(tmp_path)
            
            threat_type = analysis.get("threat_type", "safe")
            conf = analysis.get("confidence", 0.0)
            
            # 🛡️ Force consistency
            if threat_type == "safe": conf = min(conf, 0.10)
            
            return AudioThreatResult(
                confidence=conf,
                threat_type=threat_type,
                keywords_detected=analysis.get("keywords_detected", []),
                tone=analysis.get("tone", "unknown"),
                is_threat=conf >= self.threshold,
                language_detected=analysis.get("language_detected", "unknown"),
                raw_analysis=analysis.get("raw_analysis", ""),
                transcription=transcription
            )
        except Exception as e:
            # Stage 8: Fail-Safe
            return self._fail(f"Pipeline error: {str(e)}")

    def _fail(self, reason: str) -> AudioThreatResult:
        return AudioThreatResult(0.0, "safe", [], "unknown", False, "Unknown", reason, "")
