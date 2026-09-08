import {
  Activity, AirVent, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Award,
  BarChart3, BedDouble, Bell, Blocks, BookOpen, Bot, Boxes, Building2,
  Cable, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  CirclePlus, Clock, CloudSun, Cog, CookingPot, Cpu, DoorClosed, DoorOpen, Droplet, Droplets,
  Eye, Fan, Flame, Gauge, Gem, History, House, IndianRupee, Info, Layers, LayoutDashboard,
  LayoutGrid, Leaf, Lightbulb, ListFilter, Lock, MapPin, Menu, Minus, Moon, MoveRight,
  PanelLeft, Pencil, PieChart, Play, Plug, Power, PowerOff, Presentation, Radar, Radio,
  RefreshCw, Refrigerator, Rocket, Save, Search, Send, Server, Settings, Shield, ShieldAlert,
  ShieldCheck, Signal, SlidersHorizontal, Snowflake, Sofa, Sparkles, Sprout, Square, SquarePen,
  Star, Sun, Target, Thermometer, ThermometerSnowflake, ThermometerSun, Timer, TrendingDown,
  TrendingUp, Trash2, Tv, Unlock, UserX, Users, Waves, Wifi, Wind, Workflow, X, Zap,
} from 'lucide-react'

/**
 * Explicit icon registry — keeps the bundle tree-shakeable while letting data
 * files reference icons by string name.
 */
const ICONS = {
  Activity, AirVent, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Award,
  BarChart3, BedDouble, Bell, Blocks, BookOpen, Bot, Boxes, Building2,
  Cable, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  CirclePlus, Clock, CloudSun, Cog, CookingPot, Cpu, DoorClosed, DoorOpen, Droplet, Droplets,
  Eye, Fan, Flame, Gauge, Gem, History, House, IndianRupee, Info, Layers, LayoutDashboard,
  LayoutGrid, Leaf, Lightbulb, ListFilter, Lock, MapPin, Menu, Minus, Moon, MoveRight,
  PanelLeft, Pencil, PieChart, Play, Plug, Power, PowerOff, Presentation, Radar, Radio,
  RefreshCw, Refrigerator, Rocket, Save, Search, Send, Server, Settings, Shield, ShieldAlert,
  ShieldCheck, Signal, SlidersHorizontal, Snowflake, Sofa, Sparkles, Sprout, Square, SquarePen,
  Star, Sun, Target, Thermometer, ThermometerSnowflake, ThermometerSun, Timer, TrendingDown,
  TrendingUp, Trash2, Tv, Unlock, UserX, Users, Waves, Wifi, Wind, Workflow, X, Zap,
  // aliases used by data files
  Home: House,
  HomeIcon: House,
  Trash: Trash2,
  Edit: Pencil,
  Alert: AlertTriangle,
}

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.9, ...rest }) {
  const Cmp = ICONS[name] || Activity
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" {...rest} />
}
