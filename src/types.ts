// ─── Domain types ───────────────────────────────────────────────────────────

export type Rank = 'PTE' | 'LCP' | 'CPL' | 'CFC' | '3SGT' | '2SGT' | '1SGT';

export const RANKS: Rank[] = ['PTE', 'LCP', 'CPL', 'CFC', '3SGT', '2SGT', '1SGT'];

export interface User {
  rank: Rank;
  name: string;
  aliases: string[];
}

export type Purpose = 'WPT' | 'MPT';

export interface ParsedVehicle {
  mid: string;
  category: string | null;
  rawRest: string;
  tag: string | null;
  embeddedTime: { startMin: number; endMin: number } | null;
}

export interface VehicleList {
  WPT: ParsedVehicle[];
  MPT: ParsedVehicle[];
}

export interface DispatchBlock {
  text: string;
  mid: string;
  category: string | null;
  purpose: Purpose;
  startMin: number;
  endMin: number;
}

export interface GenerateResult {
  blocks: DispatchBlock[];
  wptCount: number;
  mptCount: number;
  wptOverflow: number;
  startMin: number;
  endMin: number;
  embeddedCount: number;
  total: number;
  allMatches: TrackedVehicle[];
}

// ─── Tracker types ──────────────────────────────────────────────────────────

export type TimerState = 'idle' | 'running' | 'done';
export type VehicleStatus = 'pending' | 'done';

export interface VehicleTimer {
  state: TimerState;
  startedAt: number | null;
  accumulated: number;
}

export interface TrackedVehicle {
  mid: string;
  category: string;
  purpose: Purpose;
  status: VehicleStatus;
  note: string;
  timer: VehicleTimer;
}

export interface TrackerSummary {
  wptDone: number;
  wptTotal: number;
  mptDone: number;
  mptTotal: number;
  running: number;
  pending: number;
  done: number;
  total: number;
}

// ─── App state ──────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'auto';
export type Page = 'deploy' | 'tracker' | 'update';
export type SettingsTab = 'users' | 'blocklist' | 'prefs';

export interface AppState {
  users: User[];
  activeIdx: number;
  blocklist: string[];
  theme: Theme;
  autoGen: boolean;
  trackerEnabled: boolean;
  tracker: TrackedVehicle[];
  notePresets: string[];
  page: Page;
  dayOffset: number;
}

// ─── UI message ─────────────────────────────────────────────────────────────

export type MessageKind = 'info' | 'warn' | 'err';

export interface Message {
  kind: MessageKind;
  text: string;
}

// ─── Status indicator ───────────────────────────────────────────────────────

export type StatusTone = '' | 'ok' | 'warn' | 'err';
