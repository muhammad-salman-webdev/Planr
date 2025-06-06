import React from "react";
import WeatherBar from "./WeatherBar";
import Navigation from "./Navigation";
import { CalendarPlus, Menu } from "lucide-react";

interface HeaderProps {
  appIcon: string;
  onMenuClick: () => void;
  weatherData: any;
  weatherLoading: boolean;
  weatherError: string | null;
  temperatureUnit: "C" | "F";
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onImportOpen: () => void;
}

const Header: React.FC<HeaderProps> = ({
  appIcon,
  onMenuClick,
  weatherData,
  weatherLoading,
  weatherError,
  temperatureUnit,
  selectedDate,
  onDateChange,
  onImportOpen,
}) => (
  <div>
    {/* Header 1: Planr Title & Hamburger Menu */}
    <div className="relative flex items-center justify-center px-4 py-3 bg-white border-b border-gray-200">
      <button
        onClick={onMenuClick}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-1"
        aria-label="Open menu">
        <Menu className="text-gray-600" size={24} />
      </button>
      <div className="flex items-center">
        <img src={appIcon} alt="Planr Icon" className="w-5 h-5 mr-2" />
        <h1 className="text-xl font-bold">Planr</h1>
      </div>
      <button
        onClick={onImportOpen}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
        aria-label="Open Calendar Imports Popup">
        <CalendarPlus className="text-gray-600" size={24} />
      </button>
    </div>
    {/* Header 2: WeatherBar */}
    <WeatherBar
      temperature={weatherData?.current_weather?.temperature}
      tempMax={weatherData?.daily?.temperature_2m_max?.[0]}
      tempMin={weatherData?.daily?.temperature_2m_min?.[0]}
      weatherCode={weatherData?.daily?.weathercode?.[0]}
      address={weatherData?.address}
      loading={weatherLoading}
      error={weatherError}
      temperatureUnit={temperatureUnit}
    />
    {/* Header 3: Navigation */}
    <Navigation currentDate={selectedDate} onDateChange={onDateChange} />
  </div>
);

export default Header;
