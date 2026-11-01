// The dev app recorder's log of outgoing calls (visual/fixtures/runtime.ts), as its drivers read it.
// Types only, so the app and the drivers share it without either loading the other.
// `typing`: whether a typing update says the user is typing; `convs`: the conversation ids (hex) a
// bulk channel add went to. No other param value is kept.
// `answer`: set once the call is answered, for the few methods whose answer a flow reads
// (visual/fixtures/runtime.ts answerLogged). `afterSeq` is the latest seq when it was answered, so a
// call with a higher seq went out after the answer; `error` is the error's message, when it failed.
// The result itself is never kept.
export type CallAnswer = {afterSeq: number; error?: string}
export type LoggedCall = {
  seq: number
  method: string
  paused: boolean
  typing?: boolean
  convs?: Array<string>
  answer?: CallAnswer
}
// The calls after the seq asked for and the latest seq. `runtime` is random per JS runtime (seqs start
// again in a new one), `recording` says whether calls are being logged now, and `generation` counts
// the recordings started in this runtime: a window whose runtime or generation moved missed calls.
// `droppedThrough` is the newest seq the bounded log no longer holds: a window starting before it
// lost its oldest calls.
export type CallLog = {
  seq: number
  calls: Array<LoggedCall>
  runtime: string
  recording: boolean
  generation: number
  droppedThrough: number
}
