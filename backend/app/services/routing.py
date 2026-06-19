import math

import aiohttp

from app.core.config import settings


class RoutingService:
    """Service to calculate real-world travel times and distances using OSRM or fallbacks"""

    async def get_travel_info(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> dict:
        """
        Calculate driving travel time (in minutes) and distance (in km) between two points.
        Returns a dict: {"duration_mins": float, "distance_km": float, "source": str}
        """
        lat1, lon1 = float(lat1), float(lon1)
        lat2, lon2 = float(lat2), float(lon2)

        if lat1 == lat2 and lon1 == lon2:
            return {"duration_mins": 0.0, "distance_km": 0.0, "source": "same_location"}

        if settings.ROUTING_PROVIDER == "osrm":
            try:
                # OSRM expects: longitude,latitude
                url = f"{settings.ROUTING_API_URL}/{lon1},{lat1};{lon2},{lat2}?overview=false"

                async with aiohttp.ClientSession() as session:
                    # Low timeout to prevent blocking user requests
                    async with session.get(url, timeout=3.0) as response:
                        if response.status == 200:
                            data = await response.json()
                            if "routes" in data and len(data["routes"]) > 0:
                                route = data["routes"][0]
                                duration_sec = route.get("duration", 0)  # seconds
                                distance_m = route.get("distance", 0)  # meters

                                return {
                                    "duration_mins": round(duration_sec / 60.0, 2),
                                    "distance_km": round(distance_m / 1000.0, 2),
                                    "source": "osrm",
                                }
            except Exception as e:
                # Log error and fall back
                print(f"OSRM Routing error: {e}. Falling back to geodesic estimation.")

        # Fallback: Haversine distance with winding factor + speed assumptions
        distance_km = self.calculate_haversine_distance(lat1, lon1, lat2, lon2)
        # Assumes average speed of 50 km/h and a routing winding factor of 1.3
        # Speed = 50 km/h => 0.833 km/minute
        # Duration = (Distance * 1.3) / 0.833 = Distance * 1.56
        duration_mins = round(distance_km * 1.56, 2)

        return {
            "duration_mins": duration_mins,
            "distance_km": round(distance_km, 2),
            "source": "fallback_geodesic",
        }

    def calculate_haversine_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate straight-line distance in km using Haversine formula"""
        R = 6371.0  # Earth's radius in km

        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)

        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.asin(math.sqrt(a))

        return R * c


routing_service = RoutingService()
