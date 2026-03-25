# agents/false_alarm_filter.py
import json
import httpx # type: ignore
from typing import Dict, Any, Optional

class FilterDecision:
    def __init__(self, decision: str, final_confidence: float, agents_flagged: int,
                 rule_1_passed: bool, rule_2_passed: bool, rule_3_passed: bool,
                 corroboration: Optional[str], dismissal_reason: Optional[str],
                 escalate: bool):
        self.decision = decision
        self.final_confidence = final_confidence
        self.agents_flagged = agents_flagged
        self.rule_1_passed = rule_1_passed
        self.rule_2_passed = rule_2_passed
        self.rule_3_passed = rule_3_passed
        self.corroboration = corroboration
        self.dismissal_reason = dismissal_reason
        self.escalate = escalate

    def model_dump(self):
        return self.__dict__

class FalseAlarmFilterAgent:
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.groq.com/openai/v1/chat/completions"
        self.weights = {"audio": 0.40, "movement": 0.35, "location": 0.25}

    async def decide(self, audio_data: Dict, movement_data: Dict, location_data: Dict) -> FilterDecision:
        weighted_score = (
            audio_data.get("confidence", 0) * self.weights["audio"] +
            movement_data.get("confidence", 0) * self.weights["movement"] +
            location_data.get("confidence", 0) * self.weights["location"]
        )
        
        agents_flagged = sum([
            1 if audio_data.get("is_threat") else 0,
            1 if movement_data.get("is_threat") else 0,
            1 if location_data.get("is_threat") else 0
        ])

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        prompt = f"""
        SAFEWALK MULTI-AGENT DECISION BRAIN (Llama 3.3 70B)
        INPUTS:
        1. AUDIO: {json.dumps(audio_data)}
        2. MOVEMENT: {json.dumps(movement_data)}
        3. LOCATION: {json.dumps(location_data)}
        PRE-COMPUTED: WeightedScore={weighted_score:.2f}, Flagged={agents_flagged}
        
        RULES: 
        - ESCALATE if (Flagged >= 2) AND (WeightedScore > 0.60).
        - ESCALATE if (Any Single Agent Confidence > 0.90) AND (Is_Threat == True).
        - Otherwise DISMISS.
        
        Return ONLY valid JSON:
        {{
          "decision": "ESCALATE" | "DISMISS",
          "final_confidence": <float>,
          "agents_flagged": {agents_flagged},
          "rule_1_passed": bool,
          "rule_2_passed": bool,
          "rule_3_passed": bool,
          "corroboration": "str",
          "dismissal_reason": "str",
          "escalate": bool
        }}
        """

        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": "You are a high-stakes security engine. JSON only."}, {"role": "user", "content": prompt}],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(self.url, headers=headers, json=payload)
                resp.raise_for_status()
                parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
                
                # 🛡️ AUTHORITATIVE ESCALATION LOGIC (Python-enforced)
                # LLM provides reasoning, but Python decides the 'escalate' bit for safety.
                audio_conf = audio_data.get("confidence", 0)
                is_single_critical = audio_conf > 0.90 or movement_data.get("confidence", 0) > 0.90 or location_data.get("confidence", 0) > 0.90
                
                final_decision = parsed.get("decision", "DISMISS")
                escalate_bit = bool(parsed.get("escalate", False))
                
                # FORCE ESCALATION if single agent is critical
                if is_single_critical:
                    final_decision = "ESCALATE"
                    escalate_bit = True
                elif agents_flagged >= 2 and weighted_score > 0.60:
                    final_decision = "ESCALATE"
                    escalate_bit = True

                return FilterDecision(
                    decision=final_decision,
                    final_confidence=float(parsed.get("final_confidence", weighted_score)),
                    agents_flagged=agents_flagged,
                    rule_1_passed=agents_flagged >= 2,
                    rule_2_passed=is_single_critical,
                    rule_3_passed=bool(parsed.get("rule_3_passed", False)),
                    corroboration=str(parsed.get("corroboration", "Critical Source Confirmation")),
                    dismissal_reason=None if escalate_bit else str(parsed.get("dismissal_reason", "Score below threshold")),
                    escalate=escalate_bit,
                )
        except Exception as e:
            print(f"⚠️ Filter LLM Timeout/Error: {e}")
            
        # 🛡️ FAIL-SAFE: If API is down or logic fails, use strict Python thresholds
        any_critical = any([audio_data.get("confidence", 0) > 0.90, movement_data.get("confidence", 0) > 0.90, location_data.get("confidence", 0) > 0.90])
        safe_escalate = (agents_flagged >= 2 and weighted_score > 0.60) or any_critical
        return FilterDecision("ESCALATE" if safe_escalate else "DISMISS", weighted_score, agents_flagged, agents_flagged >= 2, any_critical, False, "Fail-safe: Python Mastery", "API Error", safe_escalate)

