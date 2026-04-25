import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pencil,
  Quote,
  Sparkles,
  Square,
  Timer,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimerPanel } from "../components/TimerPanel";
import type { Note } from "../components/TimerPanel";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";
import { useActor } from "../hooks/useActor";
import { useListTasksByDate, useUpdateTask } from "../hooks/useQueries";
import { getQuotes } from "./ProfileTab";
import type { UserQuote } from "./ProfileTab";

interface NotesActor {
  getAllNotes(): Promise<Note[]>;
  updateNote(
    noteId: bigint,
    title: string,
    body: string,
    folderId: bigint,
    tags: string[],
  ): Promise<Note>;
}

// ─── Moon phase helper ────────────────────────────────────────────────────────
const REFERENCE_NEW_MOON_MS = Date.UTC(2024, 0, 11);
const LUNAR_CYCLE_DAYS = 29.53;

function getMoonPhaseEmoji(date: Date): string {
  const daysSinceRef =
    (date.getTime() - REFERENCE_NEW_MOON_MS) / (1000 * 60 * 60 * 24);
  const phase =
    ((daysSinceRef % LUNAR_CYCLE_DAYS) + LUNAR_CYCLE_DAYS) % LUNAR_CYCLE_DAYS;
  if (phase < 1.5) return "🌑";
  if (phase < 7.4) return "🌒";
  if (phase < 8.9) return "🌓";
  if (phase < 14.75) return "🌔";
  if (phase < 16.25) return "🌕";
  if (phase < 22.15) return "🌖";
  if (phase < 23.65) return "🌗";
  return "🌘";
}

// ─── Night-time detection ─────────────────────────────────────────────────────
function isNightTime(
  sunriseStr: string | undefined,
  sunsetStr: string | undefined,
  checkDate?: Date,
): boolean {
  const now = checkDate ?? new Date();
  if (sunriseStr && sunsetStr) {
    try {
      const sunrise = new Date(sunriseStr).getTime();
      const sunset = new Date(sunsetStr).getTime();
      const t = now.getTime();
      return t < sunrise || t > sunset;
    } catch {
      // fall through to hour-based fallback
    }
  }
  const h = now.getHours();
  return h < 6 || h >= 20;
}

// ─── WMO codes ────────────────────────────────────────────────────────────────
const WMO_NEUTRAL: Record<number, { label: string; emoji: string }> = {
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Foggy", emoji: "🌫" },
  48: { label: "Foggy", emoji: "🌫" },
  51: { label: "Drizzle", emoji: "🌦" },
  53: { label: "Drizzle", emoji: "🌦" },
  55: { label: "Drizzle", emoji: "🌦" },
  61: { label: "Rain", emoji: "🌧" },
  63: { label: "Rain", emoji: "🌧" },
  65: { label: "Heavy rain", emoji: "🌧" },
  71: { label: "Snow", emoji: "❄️" },
  73: { label: "Snow", emoji: "❄️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  80: { label: "Rain showers", emoji: "🌧" },
  81: { label: "Rain showers", emoji: "🌧" },
  82: { label: "Heavy showers", emoji: "🌧" },
  95: { label: "Thunderstorm", emoji: "⛈" },
};

function getWeatherInfo(
  code: number,
  night = false,
  checkDate?: Date,
): { label: string; emoji: string } {
  if (code === 0) {
    if (night) {
      const moon = getMoonPhaseEmoji(checkDate ?? new Date());
      return { label: "Clear night", emoji: moon };
    }
    return { label: "Clear sky", emoji: "☀️" };
  }
  if (code === 1) {
    if (night) {
      const moon = getMoonPhaseEmoji(checkDate ?? new Date());
      return { label: "Mainly clear night", emoji: moon };
    }
    return { label: "Mainly clear", emoji: "🌤" };
  }
  return WMO_NEUTRAL[code] ?? { label: "Unknown", emoji: "🌡" };
}

function degreesToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function pollenLevel(val: number): { label: string; color: string } {
  if (val <= 10)
    return {
      label: "Low",
      color: "bg-green-500/20 text-green-700 dark:text-green-300",
    };
  if (val <= 50)
    return {
      label: "Moderate",
      color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    };
  return {
    label: "High",
    color: "bg-red-500/20 text-red-700 dark:text-red-300",
  };
}

// ─── Module-level weather cache ───────────────────────────────────────────────
interface FullWeatherData {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  humidity: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  hourly: {
    time: string[];
    temperature: number[];
    precipProb: number[];
    weathercode: number[];
    humidity: number[];
    uvIndex: number[];
  };
  pollen: {
    grass: number;
    tree: number;
    weed: number;
  };
}

interface DailyWeatherData {
  date: string; // "2026-04-16"
  weathercode: number;
  tempMax: number;
  tempMin: number;
  precipProbMax: number;
}

let cachedFullWeather: FullWeatherData | null = null;
let cachedDailyWeather: DailyWeatherData[] | null = null;
// Store lat/lon for weekly forecast fetch — set alongside cachedFullWeather
let cachedCoords: { lat: number; lon: number } | null = null;

// ─── WeeklyWeatherCard ────────────────────────────────────────────────────────
const WeeklyWeatherCard = memo(function WeeklyWeatherCard({
  sunrise,
  sunset,
}: {
  sunrise?: string;
  sunset?: string;
}) {
  const [daily, setDaily] = useState<DailyWeatherData[] | null>(
    cachedDailyWeather,
  );
  const [loading, setLoading] = useState(cachedDailyWeather === null);

  useEffect(() => {
    if (cachedDailyWeather !== null) return;
    if (!cachedCoords) {
      // Wait for coordinates to be set by the main WeatherWidget
      const timer = setTimeout(() => {
        if (cachedCoords) {
          fetchWeekly(cachedCoords.lat, cachedCoords.lon);
        } else {
          setLoading(false);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
    fetchWeekly(cachedCoords.lat, cachedCoords.lon);

    async function fetchWeekly(lat: number, lon: number) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`,
        );
        const data = await res.json();
        const days: DailyWeatherData[] = (data.daily.time as string[]).map(
          (date, i) => ({
            date,
            weathercode: data.daily.weathercode[i] ?? 0,
            tempMax: data.daily.temperature_2m_max[i] ?? 0,
            tempMin: data.daily.temperature_2m_min[i] ?? 0,
            precipProbMax: data.daily.precipitation_probability_max[i] ?? 0,
          }),
        );
        cachedDailyWeather = days;
        setDaily(days);
      } catch {
        setLoading(false);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  // Build a 1-line human summary of the week
  const weeklySummary = useMemo(() => {
    if (!daily || daily.length === 0) return "";
    const rainDays = daily.filter((d) => d.precipProbMax >= 40);
    const stormDays = daily.filter((d) => d.weathercode >= 95);
    const snowDays = daily.filter(
      (d) => d.weathercode >= 71 && d.weathercode <= 77,
    );
    const avgMax = daily.reduce((sum, d) => sum + d.tempMax, 0) / daily.length;

    if (stormDays.length >= 2) return "⛈ Stormy week ahead — stay safe";
    if (snowDays.length >= 2) return "❄️ Snowy conditions expected this week";
    if (rainDays.length >= 4)
      return "🌧 Mostly rainy this week — keep an umbrella handy";
    if (rainDays.length >= 2) {
      const dayNames = rainDays
        .slice(0, 2)
        .map((d) =>
          new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }),
        )
        .join(" & ");
      return `🌦 Rain expected ${dayNames}`;
    }
    if (avgMax >= 30) return "🌞 Hot week ahead — stay hydrated";
    if (avgMax >= 22) return "☀️ Mostly sunny and warm this week";
    return "🌤 Mild and partly cloudy this week";
  }, [daily]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-20 w-14 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!daily || daily.length === 0) return null;

  return (
    <div className="space-y-2">
      {weeklySummary && (
        <p className="text-xs text-muted-foreground italic px-0.5">
          {weeklySummary}
        </p>
      )}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {daily.map((day, i) => {
          const date = new Date(day.date);
          const dayName =
            i === 0
              ? "Today"
              : date.toLocaleDateString(undefined, { weekday: "short" });
          // Use noon of that day to determine weather icon
          const noonOfDay = new Date(day.date);
          noonOfDay.setHours(12, 0, 0, 0);
          const night = isNightTime(sunrise, sunset, noonOfDay);
          const { emoji } = getWeatherInfo(day.weathercode, night, noonOfDay);
          const isRainy = day.precipProbMax >= 40;

          return (
            <div
              key={day.date}
              className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 min-w-[58px] border ${
                i === 0
                  ? "bg-accent/15 border-accent/30"
                  : "bg-muted/40 border-transparent"
              }`}
            >
              <p
                className={`text-[10px] font-semibold ${i === 0 ? "text-accent" : "text-muted-foreground"}`}
              >
                {dayName}
              </p>
              <span className="text-xl leading-none">{emoji}</span>
              <p className="text-xs font-bold text-foreground">
                {Math.round(day.tempMax)}°
              </p>
              <p className="text-[10px] text-muted-foreground">
                {Math.round(day.tempMin)}°
              </p>
              {day.precipProbMax > 0 && (
                <p
                  className={`text-[10px] font-medium ${isRainy ? "text-blue-500" : "text-muted-foreground"}`}
                >
                  {day.precipProbMax}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── WeatherWidget ────────────────────────────────────────────────────────────
const WeatherWidget = memo(function WeatherWidget() {
  const [weather, setWeather] = useState<FullWeatherData | null>(
    cachedFullWeather,
  );
  const [loading, setLoading] = useState(cachedFullWeather === null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cachedFullWeather !== null) return;
    if (!navigator.geolocation) {
      setError(true);
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          // Store coords for WeeklyWeatherCard to use
          cachedCoords = { lat, lon };
          const [forecastRes, aqRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,uv_index,weathercode&daily=sunrise,sunset&wind_direction_unit=degrees&timezone=auto`,
            ),
            fetch(
              `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=grass_pollen,tree_pollen,weed_pollen&timezone=auto`,
            ),
          ]);
          const forecast = await forecastRes.json();
          const aq = await aqRes.json();

          const now = new Date();
          const currentHourStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:00`;
          const hourlyTimes: string[] = forecast.hourly.time;
          let hourIdx = hourlyTimes.findIndex((t) => t === currentHourStr);
          if (hourIdx < 0) hourIdx = 0;

          const result: FullWeatherData = {
            temperature: forecast.current_weather.temperature,
            windspeed: forecast.current_weather.windspeed,
            winddirection: forecast.current_weather.winddirection,
            weathercode: forecast.current_weather.weathercode,
            humidity: forecast.hourly.relativehumidity_2m[hourIdx] ?? 0,
            uvIndex: forecast.hourly.uv_index[hourIdx] ?? 0,
            sunrise: forecast.daily.sunrise[0] ?? "",
            sunset: forecast.daily.sunset[0] ?? "",
            hourly: {
              time: hourlyTimes.slice(hourIdx, hourIdx + 24),
              temperature: forecast.hourly.temperature_2m.slice(
                hourIdx,
                hourIdx + 24,
              ),
              precipProb: forecast.hourly.precipitation_probability.slice(
                hourIdx,
                hourIdx + 24,
              ),
              weathercode: forecast.hourly.weathercode.slice(
                hourIdx,
                hourIdx + 24,
              ),
              humidity: forecast.hourly.relativehumidity_2m.slice(
                hourIdx,
                hourIdx + 24,
              ),
              uvIndex: forecast.hourly.uv_index.slice(hourIdx, hourIdx + 24),
            },
            pollen: {
              grass: aq.hourly?.grass_pollen?.[hourIdx] ?? 0,
              tree: aq.hourly?.tree_pollen?.[hourIdx] ?? 0,
              weed: aq.hourly?.weed_pollen?.[hourIdx] ?? 0,
            },
          };

          cachedFullWeather = result;
          setWeather(result);
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(true);
        setLoading(false);
      },
    );
  }, []);

  const rainSummary = useMemo(() => {
    if (!weather) return "";
    const probs = weather.hourly.precipProb;
    const times = weather.hourly.time;
    const rainHours = probs
      .map((p, i) => ({ p, t: times[i] }))
      .filter((h) => h.p >= 30);
    if (rainHours.length === 0)
      return "No rain expected in the next 24 hours ☀️";
    const maxProb = Math.max(...rainHours.map((h) => h.p));
    const first = new Date(rainHours[0].t).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const last = new Date(rainHours[rainHours.length - 1].t).toLocaleTimeString(
      [],
      { hour: "numeric", minute: "2-digit" },
    );
    if (first === last) return `~${maxProb}% chance of rain around ${first} 🌧`;
    return `~${maxProb}% chance of rain between ${first} – ${last} 🌧`;
  }, [weather]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">
          📍 Location unavailable. Please allow location access to see weather.
        </p>
      </div>
    );
  }

  const currentIsNight = isNightTime(weather.sunrise, weather.sunset);
  const { label, emoji } = getWeatherInfo(weather.weathercode, currentIsNight);
  const compass = degreesToCompass(weather.winddirection);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        data-ocid="weather.toggle"
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-3 p-4">
          <span className="text-4xl">{emoji}</span>
          <div className="flex-1">
            <p className="text-2xl font-bold text-foreground leading-none">
              {Math.round(weather.temperature)}°C
            </p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
          <div className="flex items-center gap-4 mr-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Humidity</p>
              <p className="text-sm font-semibold text-foreground">
                {weather.humidity}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Wind</p>
              <p className="text-sm font-semibold text-foreground">
                {weather.windspeed} km/h
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pb-4 space-y-4 pt-3">
              {/* Current conditions grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "UV Index", value: weather.uvIndex.toFixed(1) },
                  {
                    label: "Wind",
                    value: `${weather.windspeed} km/h ${compass}`,
                  },
                  { label: "Humidity", value: `${weather.humidity}%` },
                  { label: "Sunrise", value: formatTime(weather.sunrise) },
                  { label: "Sunset", value: formatTime(weather.sunset) },
                  {
                    label: "Feels like",
                    value: `${Math.round(weather.temperature)}°C`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-muted/40 rounded-xl p-2.5 text-center"
                  >
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-foreground mt-0.5">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Rain summary */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-0.5">
                  Rain Forecast
                </p>
                <p className="text-sm text-foreground">{rainSummary}</p>
              </div>

              {/* Pollen levels */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Pollen Levels
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(["grass", "tree", "weed"] as const).map((type) => {
                    const val = weather.pollen[type];
                    const { label: lvl, color } = pollenLevel(val);
                    return (
                      <span
                        key={type}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}: {lvl}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 24-hour horizontal scroll */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Next 24 Hours
                </p>
                <div className="relative">
                  <button
                    onClick={() =>
                      scrollRef.current?.scrollBy({
                        left: -180,
                        behavior: "smooth",
                      })
                    }
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow-sm border border-border/50"
                    type="button"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div
                    ref={scrollRef}
                    className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mx-8"
                    style={{
                      scrollbarWidth: "none",
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    {weather.hourly.time.map((timeStr, i) => {
                      const slotDate = new Date(timeStr);
                      const hourLabel = slotDate.toLocaleTimeString([], {
                        hour: "numeric",
                      });
                      const slotIsNight = isNightTime(
                        weather.sunrise,
                        weather.sunset,
                        slotDate,
                      );
                      const wInfo = getWeatherInfo(
                        weather.hourly.weathercode[i],
                        slotIsNight,
                        slotDate,
                      );
                      const prob = weather.hourly.precipProb[i] ?? 0;
                      const temp = weather.hourly.temperature[i] ?? 0;
                      return (
                        <div
                          key={timeStr}
                          className="flex-shrink-0 flex flex-col items-center gap-1 bg-muted/40 rounded-xl px-3 py-2 min-w-[60px]"
                        >
                          <p className="text-[10px] text-muted-foreground">
                            {hourLabel}
                          </p>
                          <span className="text-xl">{wInfo.emoji}</span>
                          <p className="text-xs font-bold text-foreground">
                            {Math.round(temp)}°
                          </p>
                          <p
                            className={`text-[10px] font-medium ${prob >= 50 ? "text-blue-500" : "text-muted-foreground"}`}
                          >
                            {prob}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() =>
                      scrollRef.current?.scrollBy({
                        left: 180,
                        behavior: "smooth",
                      })
                    }
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow-sm border border-border/50"
                    type="button"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── useLiveClock ─────────────────────────────────────────────────────────────
function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  const [timeFormat, setTimeFormat] = useState(
    () => localStorage.getItem("sha_time_format") || "12",
  );

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "sha_time_format") setTimeFormat(e.newValue || "12");
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      clearInterval(tick);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return useMemo(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const pad = (n: number) => String(n).padStart(2, "0");
    if (timeFormat === "24") return `${pad(h)}:${pad(m)}:${pad(s)}`;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${pad(m)}:${pad(s)} ${period}`;
  }, [now, timeFormat]);
}

// ─── LiveClock ────────────────────────────────────────────────────────────────
const LiveClock = memo(function LiveClock() {
  const clockStr = useLiveClock();
  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.08 }}
      className="mt-3"
    >
      <p className="text-6xl font-mono font-bold text-foreground tabular-nums leading-none tracking-tight">
        {clockStr}
      </p>
      <p className="text-sm font-medium text-muted-foreground mt-1">
        {todayFormatted}
      </p>
    </motion.div>
  );
});

// ─── QuoteCard component ─────────────────────────────────────────────────────
function QuoteCard({
  onNavigateToProfile,
}: { onNavigateToProfile: () => void }) {
  const [activeQuote, setActiveQuote] = useState<UserQuote | null>(() => {
    const qs = getQuotes();
    return qs.find((q) => q.isActive) ?? null;
  });

  useEffect(() => {
    const refresh = () => {
      const qs = getQuotes();
      setActiveQuote(qs.find((q) => q.isActive) ?? null);
    };
    window.addEventListener("quotesChanged", refresh);
    return () => window.removeEventListener("quotesChanged", refresh);
  }, []);

  if (!activeQuote) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="mx-5 mt-4"
      >
        <button
          type="button"
          data-ocid="home.primary_button"
          onClick={onNavigateToProfile}
          className="w-full bg-accent/10 border border-accent/20 rounded-2xl p-4 flex items-center gap-3 hover:bg-accent/15 transition-colors"
        >
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
          <span className="text-sm text-accent font-medium">
            Tap to add your quote ✨
          </span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="mx-5 mt-4"
    >
      <div className="bg-gradient-to-br from-accent/15 to-card border border-accent/25 rounded-2xl p-4 flex items-start gap-3">
        <Quote className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-sm italic text-foreground leading-relaxed">
          {activeQuote.text}
        </p>
      </div>
    </motion.div>
  );
}

// ─── HomeTab ──────────────────────────────────────────────────────────────────
export default function HomeTab() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { actor } = useActor();
  const today = new Date().toISOString().split("T")[0];
  const { data: tasks, isLoading } = useListTasksByDate(today);
  const updateTask = useUpdateTask();

  const [notes, setNotes] = useState<Note[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<bigint | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const notesActor = actor as unknown as NotesActor | null;

  useEffect(() => {
    if (!showTimer || !notesActor || notes.length > 0) return;
    notesActor
      .getAllNotes()
      .then(setNotes)
      .catch(() => {});
  }, [showTimer, notesActor, notes.length]);

  const handleSaveToNote = async (noteId: bigint, sessionText: string) => {
    if (!notesActor) return;
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const newBody =
      `${(note as unknown as { body: string }).body}\n${sessionText}`.trim();
    await notesActor.updateNote(
      noteId,
      (note as unknown as { title: string }).title,
      newBody,
      (note as unknown as { folderId: bigint }).folderId,
      (note as unknown as { tags: string[] }).tags,
    );
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t.goodMorning;
    if (h < 17) return t.goodAfternoon;
    return t.goodEvening;
  }, [t]);

  const completed = useMemo(
    () => (tasks || []).filter((tk) => tk.completed).length,
    [tasks],
  );
  const total = tasks?.length ?? 0;

  const toggleTask = useCallback(
    (task: {
      id: bigint;
      title: string;
      description: string;
      completed: boolean;
    }) => {
      updateTask.mutate({
        taskId: task.id,
        title: task.title,
        description: task.description,
        completed: !task.completed,
      });
    },
    [updateTask],
  );

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      {/* Branding hero */}
      <div className="px-5 pt-4 pb-2">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <span className="text-5xl font-black tracking-tight text-foreground leading-none">
            Sha
          </span>
          <p className="text-xs font-bold tracking-widest uppercase text-accent">
            by Aenset
          </p>
        </motion.div>

        <LiveClock />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-4"
        >
          <h2 className="text-2xl font-bold text-foreground">
            {greeting}, {user?.name || "User"}!
          </h2>
        </motion.div>
      </div>

      {/* Greeting card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="mx-5 mt-4"
      >
        <div className="bg-gradient-to-br from-accent/20 to-card border border-accent/20 rounded-2xl p-4 card-glow">
          <p className="font-semibold text-foreground">
            Ready to make today count?
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            You have{" "}
            <span className="text-accent font-semibold">{total} tasks</span>{" "}
            scheduled. Stay focused and keep the momentum going!
          </p>
        </div>
      </motion.div>

      {/* Day at a Glance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="mx-5 mt-5"
      >
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          {t.yourDayAtAGlance}
        </h3>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
          <p className="text-xs font-semibold text-muted-foreground">
            {t.todaysChecklist}
          </p>
          <p className="text-3xl font-black text-foreground">
            {completed}/{total}
          </p>
          <p className="text-xs text-muted-foreground">tasks done</p>
        </div>
      </motion.div>

      {/* Today's Checklist - full width scrollable */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mx-5 mt-4"
      >
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          {t.todaysChecklist}
        </h3>
        <div className="bg-card border border-border rounded-2xl p-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-5/6" />
            </div>
          ) : tasks && tasks.length > 0 ? (
            <div
              className="max-h-48 overflow-y-auto space-y-2"
              data-ocid="home.list"
            >
              {tasks.map((task, i) => (
                <div
                  key={task.id.toString()}
                  data-ocid={`home.item.${i + 1}`}
                  className="flex items-center gap-2 group"
                >
                  <button
                    type="button"
                    data-ocid={`home.checkbox.${i + 1}`}
                    onClick={() => toggleTask(task)}
                    className="flex-shrink-0"
                  >
                    {task.completed ? (
                      <CheckSquare className="w-4 h-4 text-accent" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {editingTaskId === task.id ? (
                    <input
                      className="flex-1 text-xs bg-muted rounded px-2 py-1 text-foreground border border-accent outline-none"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        if (editingTitle.trim()) {
                          updateTask.mutate({
                            taskId: task.id,
                            title: editingTitle.trim(),
                            description: task.description,
                            completed: task.completed,
                          });
                        }
                        setEditingTaskId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (editingTitle.trim()) {
                            updateTask.mutate({
                              taskId: task.id,
                              title: editingTitle.trim(),
                              description: task.description,
                              completed: task.completed,
                            });
                          }
                          setEditingTaskId(null);
                        }
                        if (e.key === "Escape") setEditingTaskId(null);
                      }}
                    />
                  ) : (
                    <span
                      className={`flex-1 text-xs leading-tight ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {task.title}
                    </span>
                  )}
                  <button
                    type="button"
                    data-ocid={`home.edit_button.${i + 1}`}
                    onClick={() => {
                      setEditingTaskId(task.id);
                      setEditingTitle(task.title);
                    }}
                    className="flex-shrink-0 transition-opacity"
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground hover:text-accent" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p
              className="text-xs text-muted-foreground text-center py-2"
              data-ocid="home.empty_state"
            >
              {t.noTasksToday}
            </p>
          )}
        </div>
      </motion.div>

      {/* Motivating Quote */}
      <QuoteCard
        onNavigateToProfile={() =>
          window.dispatchEvent(new Event("navigateToProfile"))
        }
      />

      {/* Weather Widget + Weekly Summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="mx-5 mt-5"
      >
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          Weather
        </h3>
        <WeatherWidget />
      </motion.div>

      {/* Weekly Weather Summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="mx-5 mt-3"
      >
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            7-Day Forecast
          </p>
          <WeeklyWeatherCard
            sunrise={cachedFullWeather?.sunrise}
            sunset={cachedFullWeather?.sunset}
          />
        </div>
      </motion.div>

      {/* Timer & Stopwatch */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36 }}
        className="mx-5 mt-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Timer &amp; Stopwatch
          </h3>
          <Button
            data-ocid="home.toggle"
            size="sm"
            variant={showTimer ? "default" : "outline"}
            onClick={() => setShowTimer((p) => !p)}
            className="gap-1 h-7 text-xs"
          >
            <Timer className="w-3.5 h-3.5" />
            {showTimer ? "Hide" : "Open"}
          </Button>
        </div>
        <AnimatePresence>
          {showTimer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden -mx-5"
            >
              <TimerPanel
                onClose={() => setShowTimer(false)}
                notes={notes}
                onSaveToNote={handleSaveToNote}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
