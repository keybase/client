// The dev app recorder's log of outgoing calls (visual/fixtures/runtime.ts), as its drivers read it.
// Types only, so the app and the drivers share it without either loading the other.
export type LoggedCall = {seq: number; method: string; paused: boolean; typing?: boolean}
// The calls after the seq asked for and the latest seq. `runtime` is random per JS runtime (seqs start
// again in a new one), `recording` says whether calls are being logged now, and `generation` counts
// the recordings started in this runtime: a window whose runtime or generation moved missed calls.
export type CallLog = {seq: number; calls: Array<LoggedCall>; runtime: string; recording: boolean; generation: number}
