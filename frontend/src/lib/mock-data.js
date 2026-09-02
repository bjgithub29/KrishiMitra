const isDemo = () => true;
import { Sun, CloudRain, Cloud, CloudSun, CloudDrizzle, Wind } from "lucide-react";

export const farmer = !isDemo() ? { name: "Farmer", village: "", district: "", mode: "", phone: "", language: "", memberSince: "" } : {
  name: "Ramesh Patil",
  village: "Shirdi",
  district: "Ahmednagar",
  mode: "moderate",
  phone: "+91 98765 43210",
  language: "Marathi",
  memberSince: "June 2025",
};

export const weatherNow = !isDemo() ? { temp: "--", condition: "--", humidity: "--", wind: "--", rainChance: "--", uv: "--", soilMoisture: "--" } : {
  temp: 29,
  condition: "Partly Cloudy",
  humidity: 64,
  wind: 12,
  rainChance: 20,
  uv: 6,
  soilMoisture: 41,
};

export const forecast = [
  { day: "Today", icon: CloudSun, hi: 31, lo: 22, rain: 20 },
  { day: "Thu", icon: Sun, hi: 33, lo: 23, rain: 5 },
  { day: "Fri", icon: Sun, hi: 34, lo: 24, rain: 0 },
  { day: "Sat", icon: Cloud, hi: 31, lo: 23, rain: 35 },
  { day: "Sun", icon: CloudRain, hi: 28, lo: 21, rain: 80 },
  { day: "Mon", icon: CloudDrizzle, hi: 27, lo: 21, rain: 60 },
  { day: "Tue", icon: Wind, hi: 29, lo: 22, rain: 15 },
];

export const todayTasks = [
  {
    id: "t1",
    title: "Irrigate Block A — 45 min drip cycle",
    time: "06:00",
    priority: "high",
    status: "done",
    category: "Irrigation",
  },
  {
    id: "t2",
    title: "Scout for stem borer in soybean rows 4–9",
    time: "08:30",
    priority: "high",
    status: "pending",
    category: "Crop Health",
  },
  {
    id: "t3",
    title: "Apply micronutrient foliar spray (Zn + B)",
    time: "10:00",
    priority: "medium",
    status: "pending",
    category: "Nutrition",
  },
  {
    id: "t4",
    title: "Service diesel pump — replace fuel filter",
    time: "14:00",
    priority: "medium",
    status: "delayed",
    category: "Equipment",
  },
  {
    id: "t5",
    title: "Record weekly growth photos for Block B",
    time: "17:00",
    priority: "low",
    status: "pending",
    category: "Monitoring",
  },
];

export const alerts = [
  {
    id: "a1",
    severity: "critical",
    title: "Heavy rain expected Sunday",
    detail:
      "80% chance of 40–60mm rainfall. Postpone Sunday spraying; check drainage channels in Block A before Saturday evening.",
    time: "2h ago",
    source: "Weather Intelligence",
  },
  {
    id: "a2",
    severity: "warning",
    title: "Pump maintenance overdue by 3 days",
    detail:
      "The diesel pump service task has been delayed. Irrigation reliability risk rises during the upcoming wet spell.",
    time: "5h ago",
    source: "Schedule Monitor",
  },
  {
    id: "a3",
    severity: "warning",
    title: "Nitrogen trending low in Block B",
    detail:
      "Soil model estimates N depletion ahead of the flowering stage. Consider split urea application within 6 days.",
    time: "1d ago",
    source: "Soil Model",
  },
  {
    id: "a4",
    severity: "info",
    title: "Market: soybean prices up 4.2%",
    detail: "Mandi price trend is favourable. Review your break-even panel in Expense Tracker.",
    time: "1d ago",
    source: "Market Signals",
  },
];

export const farms = [
  {
    id: "f1",
    name: "Home Farm — Block A",
    village: "Shirdi",
    district: "Ahmednagar",
    area: 3.2,
    soilType: "Black Cotton (Vertisol)",
    irrigation: "Drip + Borewell",
    season: "Kharif 2026",
    status: "active",
    crop: "Soybean",
    health: 86,
  },
  {
    id: "f2",
    name: "River Plot — Block B",
    village: "Rahata",
    district: "Ahmednagar",
    area: 1.8,
    soilType: "Alluvial Loam",
    irrigation: "Canal + Sprinkler",
    season: "Kharif 2026",
    status: "active",
    crop: "Maize",
    health: 74,
  },
  {
    id: "f3",
    name: "Upland Plot",
    village: "Shirdi",
    district: "Ahmednagar",
    area: 1.1,
    soilType: "Red Sandy Loam",
    irrigation: "Rainfed",
    season: "—",
    status: "fallow",
    crop: null,
    health: 0,
  },
];

export const soilReport = !isDemo() ? { ph: "--", nitrogen: "--", phosphorus: "--", potassium: "--", moisture: "--", temperature: "--", lastTested: "--" } : {
  ph: 7.1,
  n: 212,
  p: 18,
  k: 284,
  oc: 0.58,
  ec: 0.42,
  zn: 0.9,
  fe: 6.2,
  updated: "12 Jun 2026",
  lab: "KVK Ahmednagar Soil Lab",
};

export const equipment = [
  {
    id: "e1",
    name: "Mahindra 575 DI Tractor",
    type: "Tractor",
    status: "available",
    lastService: "18 May 2026",
    hours: 1240,
  },
  {
    id: "e2",
    name: "5 HP Diesel Pump",
    type: "Pump",
    status: "maintenance",
    lastService: "02 Mar 2026",
    hours: 860,
  },
  {
    id: "e3",
    name: "Drip Irrigation Kit — 3.2 acre",
    type: "Irrigation",
    status: "available",
    lastService: "10 Jun 2026",
    hours: 0,
  },
  {
    id: "e4",
    name: "Knapsack Power Sprayer",
    type: "Sprayer",
    status: "available",
    lastService: "28 May 2026",
    hours: 145,
  },
  {
    id: "e5",
    name: "Rotavator 6ft",
    type: "Implement",
    status: "in-use",
    lastService: "20 Apr 2026",
    hours: 410,
  },
];

export const cropRecommendations = [
  {
    id: "c1",
    name: "Soybean (JS 20-98)",
    score: 94,
    primary: true,
    duration: "95–100 days",
    yield: "11–13 q/acre",
    profit: "₹38,500 est. margin/acre",
    weatherMatch: 96,
    soilMatch: 92,
    equipmentMatch: 95,
    why: "Excellent fit for black cotton soil with pH 7.1. Monsoon onset window aligns with sowing. Your drip system covers dry-spell risk, and current mandi trends favour oilseeds.",
  },
  {
    id: "c2",
    name: "Maize (Hybrid)",
    score: 87,
    primary: false,
    duration: "100–110 days",
    yield: "22–26 q/acre",
    profit: "₹31,200 est. margin/acre",
    weatherMatch: 90,
    soilMatch: 84,
    equipmentMatch: 92,
    why: "Strong yield potential with sprinkler support. Slightly higher nitrogen demand than your current soil profile supports without split application.",
  },
  {
    id: "c3",
    name: "Pigeon Pea (Tur)",
    score: 81,
    primary: false,
    duration: "160–180 days",
    yield: "7–9 q/acre",
    profit: "₹27,800 est. margin/acre",
    weatherMatch: 85,
    soilMatch: 88,
    equipmentMatch: 70,
    why: "Great soil-health rotation choice and low water need, but the longer duration ties up land through Rabi and needs a seed drill you don't currently list.",
  },
];

export const cropStages = [
  { stage: "Land Prep & Sowing", window: "Jun 15 – Jun 28", status: "done", tasks: 6 },
  { stage: "Germination & Establishment", window: "Jun 28 – Jul 12", status: "done", tasks: 4 },
  { stage: "Vegetative Growth", window: "Jul 12 – Aug 05", status: "active", tasks: 9 },
  { stage: "Flowering", window: "Aug 05 – Aug 22", status: "upcoming", tasks: 7 },
  { stage: "Pod Development", window: "Aug 22 – Sep 15", status: "upcoming", tasks: 5 },
  { stage: "Maturity & Harvest", window: "Sep 15 – Oct 02", status: "upcoming", tasks: 6 },
];

export const expenses = [
  {
    id: "x1",
    date: "02 Jul",
    category: "Seeds",
    label: "Soybean JS 20-98 certified seed",
    amount: 6800,
  },
  {
    id: "x2",
    date: "05 Jul",
    category: "Fertilizer",
    label: "DAP 2 bags + potash 1 bag",
    amount: 4350,
  },
  {
    id: "x3",
    date: "09 Jul",
    category: "Labour",
    label: "Weeding — 6 workers × 1 day",
    amount: 2400,
  },
  { id: "x4", date: "12 Jul", category: "Fuel", label: "Diesel for pump & tractor", amount: 1850 },
  {
    id: "x5",
    date: "15 Jul",
    category: "Crop Protection",
    label: "Pre-emergent herbicide",
    amount: 1620,
  },
  { id: "x6", date: "18 Jul", category: "Labour", label: "Spraying labour", amount: 800 },
];

export const expenseByCategory = [
  { name: "Seeds", value: 6800 },
  { name: "Fertilizer", value: 4350 },
  { name: "Labour", value: 3200 },
  { name: "Fuel", value: 1850 },
  { name: "Protection", value: 1620 },
];

export const notifications = [
  {
    id: "n1",
    type: "alert",
    title: "Critical: heavy rain alert issued for Sunday",
    time: "2h ago",
    read: false,
  },
  {
    id: "n2",
    type: "schedule",
    title: "Task rescheduled: foliar spray moved to 10:00",
    time: "4h ago",
    read: false,
  },
  {
    id: "n3",
    type: "ai",
    title: "New AI advisory: split nitrogen application for Block B",
    time: "1d ago",
    read: false,
  },
  {
    id: "n4",
    type: "schedule",
    title: "You marked 'Irrigate Block A' as done",
    time: "1d ago",
    read: true,
  },
  {
    id: "n5",
    type: "alert",
    title: "Pump maintenance reminder escalated",
    time: "2d ago",
    read: true,
  },
  {
    id: "n6",
    type: "ai",
    title: "Crop plan progress: vegetative stage 62% complete",
    time: "3d ago",
    read: true,
  },
  {
    id: "n7",
    type: "system",
    title: "Market prices updated for your region",
    time: "5d ago",
    read: true,
  },
];
