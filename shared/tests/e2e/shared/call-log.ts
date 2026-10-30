// The dev app recorder's log of outgoing calls (visual/fixtures/runtime.ts), as its drivers read it.
// Types only, so the app and the drivers share it without either loading the other.
export type LoggedCall = {seq: number; method: string; paused: boolean; typing?: boolean}
// the calls after the seq asked for, and the latest seq
export type CallLog = {seq: number; calls: Array<LoggedCall>}
