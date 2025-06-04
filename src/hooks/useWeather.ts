import { useState, useEffect } from 'react';

export default function useWeather() {
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeatherError("Geolocation is not supported by your browser.");
      setWeatherLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
          );
          if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
          }
          const weatherApiData = await response.json();
          let formattedAddress = "Location not found";
          try {
            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
            );
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              if (geoData && geoData.address) {
                const { city, town, village, country, suburb } = geoData.address;
                const locationParts = [city, town, village, suburb, country].filter(Boolean);
                if (locationParts.length > 0) {
                  formattedAddress = locationParts.slice(0, 2).join(', ');
                }
              }
            }
          } catch {}
          setWeatherData({ ...weatherApiData, address: formattedAddress });
          setWeatherLoading(false);
        } catch (err) {
          setWeatherError(err instanceof Error ? `Failed to fetch weather or location: ${err.message}` : "Failed to fetch weather: Unknown error");
          setWeatherLoading(false);
        }
      },
      (error) => {
        setWeatherError(`Geolocation error: ${error.message}`);
        setWeatherLoading(false);
      }
    );
  }, []);

  return { weatherData, weatherLoading, weatherError };
}
