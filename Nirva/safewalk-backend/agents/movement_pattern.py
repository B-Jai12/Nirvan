import base64
import json
import httpx # type: ignore
import os
from pydantic import BaseModel # type: ignore
from typing import Optional

class VisionAnalysisResult:
    def __init__(self, confidence: float, threat_type: str, persons_detected: int, 
                 proximity: str, body_language: str, environment: str, 
                 is_threat: bool, raw_analysis: str):
        self.confidence = confidence
        self.threat_type = threat_type
        self.persons_detected = persons_detected
        self.proximity = proximity
        self.body_language = body_language
        self.environment = environment
        self.is_threat = is_threat
        self.raw_analysis = raw_analysis

    def model_dump(self):
        return self.__dict__

class VisionThreatDetector:
    def __init__(self, api_key: str, model: str = "meta-llama/llama-4-scout-17b-16e-instruct"):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.groq.com/openai/v1/chat/completions"

    async def analyse(self, base64_image: str) -> VisionAnalysisResult:
        """
        Analyses a base64 encoded camera frame for visual threat patterns.
        """
        # Fail-safe default
        default_res = VisionAnalysisResult(
            confidence=0.0, 
            threat_type="safe", 
            persons_detected=0,
            proximity="none", 
            body_language="none", 
            environment="unknown",
            is_threat=False, 
            raw_analysis="Vision analysis failed or frame unusable."
        )

        if not base64_image:
            return default_res

        # Remove data:image/jpeg;base64, prefix if present
        if "," in base64_image:
            base64_image = base64_image.split(",")[1]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        prompt = """
        Analyze this camera frame for human safety threats. Look for:
        1. Fighting/Violence: Physical contact, hitting, or aggressive grappling.
        2. Following: Same person appearing in multiple frames or positioned behind the user.
        3. Crowding: Multiple people surrounding the user in close proximity.
        4. Aggressive Approach: Rapid movement or confrontational posture toward the camera.
        5. Grabbing: Physical contact or hands reaching for the camera/user.
        6. Isolated Location: Dark alley, empty street, or desolate environment.

        CRITICAL: If you see ANY aggressive action, physical contact, or suspicious person tracking, 
        assign a confidence >= 0.75. When in doubt, score HIGHER (Safety First).

        Return ONLY a JSON object with this exact structure:
        {
          "confidence": (0.0 to 1.0),
          "threat_type": ("violence" | "following" | "crowding" | "aggressive_approach" | "grabbing" | "isolated_location" | "safe"),
          "persons_detected": (number),
          "proximity": (concise string, e.g. "close - within 1m"),
          "body_language": (concise string, e.g. "aggressive/fighting"),
          "environment": (concise string, e.g. "dark alley"),
          "is_threat": (boolean, true if confidence >= 0.65),
          "raw_analysis": (One-sentence logic)
        }
        """

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        }
                    ]
                }
            ],
            "response_format": {"type": "json_object"}
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                
                # Ensure types and threshold
                conf = float(parsed.get("confidence", 0))
                is_threat = conf >= 0.65
                
                return VisionAnalysisResult(
                    confidence=conf,
                    threat_type=str(parsed.get("threat_type", "safe")),
                    persons_detected=int(parsed.get("persons_detected", 0)),
                    proximity=str(parsed.get("proximity", "none")),
                    body_language=str(parsed.get("body_language", "none")),
                    environment=str(parsed.get("environment", "none")),
                    is_threat=is_threat,
                    raw_analysis=str(parsed.get("raw_analysis", "No analysis provided."))
                )
        except Exception as e:
            print(f"👁️ Vision Agent Error: {e}")
            if 'resp' in locals():
                print(f"👁️ API Response: {resp.text}")
        
        return default_res
