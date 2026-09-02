class AlertEngine:

    def generate_alerts(self, weather):
        alerts = []

        if weather.get("temperature", 0) > 40:
            alerts.append({"type": "warning", "message": "High temperature. Increase irrigation."})

        if weather.get("temperature", 0) < 10:
            alerts.append({"type": "warning", "message": "Low temperature. Protect crops from cold."})

        if weather.get("precipitation", 0) > 20:
            alerts.append({"type": "critical", "message": "Heavy rainfall expected. Avoid irrigation."})

        if weather.get("precipitation", 0) == 0:
            alerts.append({"type": "info", "message": "No rainfall expected. Irrigation may be required."})

        if weather.get("wind_speed", 0) > 30:
            alerts.append({"type": "critical", "message": "Strong winds expected. Secure crops."})

        if weather.get("humidity", 0) > 90:
            alerts.append({"type": "warning", "message": "High humidity. Monitor crops for fungal diseases."})

        return alerts


alert_engine = AlertEngine()