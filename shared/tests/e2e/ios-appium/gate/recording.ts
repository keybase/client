import {attemptToken, type AttemptToken} from './attempt.ts'
import type {PhoneRecording} from './recorder.ts'

export type Recorder = {recording?: PhoneRecording; error?: string; captureError?: string}

// each attempt's recorder, so a timed-out body that finishes late reaches only its own
export const recorders = new WeakMap<AttemptToken, Recorder>()

// The running attempt's recording, for a flow that checkpoints after something that starts a new JS runtime.
export const attemptRecording = (): PhoneRecording => {
  const recording = recorders.get(attemptToken())?.recording
  if (!recording) throw new Error('the attempt has no recording')
  return recording
}
