import React from 'react';

interface WeatherInfo {
  description: string;
  icon: string;
}

const getWeatherDescription = (code?: number): WeatherInfo => {
  if (code === undefined) return { description: 'Weather data not available', icon: '❓' };
  switch (code) {
    case 0:
      return { description: 'Clear sky', icon: '☀️' };
    case 1:
    case 2:
    case 3:
      return { description: 'Mainly clear, partly cloudy, or overcast', icon: '☁️' };
    case 45:
    case 48:
      return { description: 'Fog', icon: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { description: 'Drizzle', icon: '💧' };
    case 56:
    case 57:
      return { description: 'Freezing Drizzle', icon: '🥶💧' };
    case 61:
    case 63:
    case 65:
      return { description: 'Rain', icon: '🌧️' };
    case 66:
    case 67:
      return { description: 'Freezing Rain', icon: '🥶🌧️' };
    case 71:
    case 73:
    case 75:
      return { description: 'Snow fall', icon: '❄️' };
    case 77:
      return { description: 'Snow grains', icon: '🌨️' };
    case 80:
    case 81:
    case 82:
      return { description: 'Rain showers', icon: '🌦️' };
    case 85:
    case 86:
      return { description: 'Snow showers', icon: '🌨️❄️' };
    case 95:
    case 96:
    case 99:
      return { description: 'Thunderstorm', icon: '⛈️' };
    default:
      return { description: `Unknown weather code: ${code}`, icon: '❓' };
  }
};

interface WeatherBarProps {
  temperature?: number;
  tempMax?: number;
  tempMin?: number;
  weatherCode?: number;
  address?: string;
  loading: boolean;
  error: string | null;
  temperatureUnit: 'C' | 'F'; // Restored temperatureUnit prop
}

// Helper function to convert Celsius to Fahrenheit
const convertCelsiusToFahrenheit = (celsius: number): number => {
  return (celsius * 9/5) + 32;
};

const WeatherBar: React.FC<WeatherBarProps> = ({ 
  temperature,
  tempMax,
  tempMin,
  weatherCode,
  address,
  loading,
  error,
  temperatureUnit // Destructure temperatureUnit
}) => {
  const weatherInfo = getWeatherDescription(weatherCode);

  // displayTemp function that uses temperatureUnit to format temperature
  const displayTemp = (tempInCelsius?: number): string => {
    if (tempInCelsius === undefined) return '--';
    if (temperatureUnit === 'F') {
      const tempInFahrenheit = convertCelsiusToFahrenheit(tempInCelsius);
      return `${tempInFahrenheit.toFixed(1)}°F`;
    }
    return `${tempInCelsius.toFixed(1)}°C`;
  };

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-center text-gray-600 bg-gray-100 border-b border-gray-200">
        Loading weather...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 text-sm text-center text-red-600 bg-red-100 border-b border-gray-200 truncate" title={`Could not fetch weather: ${error}`}>
        Could not fetch weather: {error}
      </div>
    );
  }

  // Check for essential data: temperature and weatherCode are primary.
  // Max/Min and address are enhancements.
  if (temperature === undefined || weatherCode === undefined) {
    return (
      <div className="px-3 py-2 text-sm text-center text-gray-500 bg-gray-100 border-b border-gray-200">
        Weather data not available.
      </div>
    );
  }

  return (
    <div className="px-3 py-2 text-sm text-gray-700 bg-blue-50 border-b border-gray-200">
      <div className="flex flex-col items-center space-y-1">
        {address && (
          <div className="text-xs text-gray-600 mb-1 text-center">{address}</div>
        )}
        <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-base">
            {weatherInfo.icon} {displayTemp(temperature)}
          </span>
          {(tempMax !== undefined && tempMin !== undefined) && (
            <span className="text-xs">
              (Max: {displayTemp(tempMax)}, Min: {displayTemp(tempMin)})
            </span>
          )}
          <span className="text-xs italic">{weatherInfo.description}</span>
        </div>
      </div>
    </div>
  );
};

export default WeatherBar;
