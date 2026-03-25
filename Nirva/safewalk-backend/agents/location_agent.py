import json
import httpx # type: ignore
import math
from typing import List, Optional, Dict
from datetime import datetime

class LocationAnalyseResult:
    def __init__(self, confidence: float, threat_type: str, current_speed: float, 
                 direction_change: float, distance_from_safe_zone: float, 
                 stationary_duration: int, time_of_day: str, is_threat: bool, 
                 raw_analysis: str):
        self.confidence = confidence
        self.threat_type = threat_type
        self.current_speed = current_speed
        self.direction_change = direction_change
        self.distance_from_safe_zone = distance_from_safe_zone
        self.stationary_duration = stationary_duration
        self.time_of_day = time_of_day
        self.is_threat = is_threat
        self.raw_analysis = raw_analysis

    def model_dump(self):
        return self.__dict__

class LocationAnomalyDetector:
    def __init__(self, api_key: str, model: str = "llama-3.1-8b-instant"):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.groq.com/openai/v1/chat/completions"
        
        # Default Safe Zones (Latitude, Longitude)
        self.safe_zones = {
            "home": (17.3850, 78.4867), # Default Hyderabad
            "college": (17.4000, 78.5000),
            "work": (17.4500, 78.3800)
        }

    def _haversine(self, lat1, lon1, lat2, lon2):
        """Calculate the great circle distance between two points in meters."""
        R = 6371000 # Earth radius in meters
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

    def _calculate_metrics(self, history: List[Dict]):
        """Compute speed, bearing change, and stationary duration from history."""
        if len(history) < 2:
            return 0.0, 0.0, 0
        
        p1 = history[-2]
        p2 = history[-1]
        
        # Speed (m/s)
        dist = self._haversine(p1['lat'], p1['lon'], p2['lat'], p2['lon'])
        time_diff = (p2['ts'] - p1['ts']) / 1000.0 # to seconds
        speed = dist / time_diff if time_diff > 0 else 0.0
        
        # Simple Stationary check (last 3 points)
        stationary_duration = 0
        if len(history) >= 3:
            # Check if moved less than 2 meters in last 30s
            total_dist = 0
            for i in range(1, len(history)):
                total_dist += self._haversine(history[i-1]['lat'], history[i-1]['lon'], 
                                           history[i]['lat'], history[i]['lon'])
            if total_dist < 5: # Threshold for 'stationary'
                stationary_duration = int((history[-1]['ts'] - history[0]['ts']) / 1000.0)

        # Bearing/Direction Change (Simplified)
        # Lat/Lon to bearing is complex, we'll use a rough indicator for now
        # Actually, for the prompt, we just want to know if they turned sharply
        bearing_change = 0.0 # Placeholder for advanced math if needed
        
        return speed, bearing_change, stationary_duration

    async def analyse(self, history: List[Dict], current_lat: float, current_lon: float) -> LocationAnalyseResult:
        # Default result
        default_res = LocationAnalyseResult(
            confidence=0.0, threat_type="safe", current_speed=0.0, 
            direction_change=0.0, distance_from_safe_zone=9999, 
            stationary_duration=0, time_of_day="unknown", is_threat=False, 
            raw_analysis="Safe movement or insufficient data."
        )

        if not history:
            return default_res

        speed, bearing, stay = self._calculate_metrics(history)
        
        # Find distance to nearest safe zone
        min_dist = min([self._haversine(current_lat, current_lon, sz[0], sz[1]) for sz in self.safe_zones.values()])
        
        time_of_day = "night" if datetime.now().hour >= 19 or datetime.now().hour <= 6 else "day"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        prompt = f"""
        LOCATION ANOMALY ANALYSIS:
        Current Speed: {speed:.2f} m/s
        Stationary Duration: {stay} seconds
        Distance from nearest Safe Zone: {min_dist:.0f} meters
        Direction Change: {bearing} degrees
        Time of Day: {time_of_day}

        Analyze this spatial data for threats:
        1. route_deviation: Unexpected path change.
        2. stationary_in_unsafe_zone: Stopped in isolated area for too long.
        3. speed_anomaly: ONLY if Current Speed > 4.0 m/s. If speed is 0.00 m/s, they are STATIONARY, NOT RUNNING.
        4. repeated_circling: Containment pattern.
        5. unknown_area_at_night: High risk context.

        CRITICAL: Speed 0.00 m/s is NOT "running". It is "stationary".

        Return ONLY JSON:
        {{
          "confidence": (0.0-1.0),
          "threat_type": ("route_deviation"|"stationary_in_unsafe_zone"|"speed_anomaly"|"repeated_circling"|"unknown_area_at_night"|"safe"),
          "is_threat": (bool, true if conf >= 0.65),
          "raw_analysis": (One-sentence logic)
        }}
        """

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"}
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()["choices"][0]["message"]["content"]
                parsed = json.loads(data)
                
                # Robustness check: Handle list vs dict
                if isinstance(parsed, list) and len(parsed) > 0:
                    parsed = parsed[0]
                
                if not isinstance(parsed, dict):
                    print(f"📍 Location Agent: Unexpected JSON type: {type(parsed)}")
                    return default_res
                
                return LocationAnalyseResult(
                    confidence=float(parsed.get("confidence", 0)),
                    threat_type=str(parsed.get("threat_type", "safe")),
                    current_speed=speed,
                    direction_change=bearing,
                    distance_from_safe_zone=min_dist,
                    stationary_duration=stay,
                    time_of_day=time_of_day,
                    is_threat=bool(parsed.get("is_threat", False)),
                    raw_analysis=str(parsed.get("raw_analysis", ""))
                )
        except Exception as e:
            print(f"📍 Location Agent Error: {e}")
        
        return default_res
