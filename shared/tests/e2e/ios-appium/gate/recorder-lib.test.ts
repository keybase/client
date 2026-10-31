import type {CallLog, LoggedCall} from '../../shared/call-log.ts'
import {callMarkOf, callsInWindow, nextRecordingAction, uiCallsOf} from './recorder-lib'

test('a recording is taken from the runtime it started in', () => {
  expect(nextRecordingAction('a', 'a')).toBe('take')
})

test('a different runtime restarts the recording', () => {
  expect(nextRecordingAction('a', 'b')).toBe('restart')
})

test('a runtime that has not loaded yet is waited for', () => {
  expect(nextRecordingAction('a', undefined)).toBe('wait')
})

const log = (o: Partial<CallLog> = {}): CallLog => ({calls: [], droppedThrough: 0, generation: 1, recording: true, runtime: 'r1', seq: 4, ...o})
const call = (method: string, paused = false, seq = 5): LoggedCall => ({method, paused, seq})

test('a mark is opened only while the recorder is recording', () => {
  expect(callMarkOf(log())).toEqual({generation: 1, runtime: 'r1', seq: 4})
  expect(() => callMarkOf(log({recording: false}))).toThrow(/not recording/)
})

test('a window in the same runtime and recording reads its calls', () => {
  const calls = [call('a.b')]
  expect(callsInWindow(callMarkOf(log()), log({calls, seq: 5}))).toEqual(calls)
})

test('a window the runtime changed inside throws, even with an empty log', () => {
  expect(() => callsInWindow(callMarkOf(log()), log({runtime: 'r2', seq: 0}))).toThrow(/new JS runtime/)
})

test('a window the recording stopped inside throws, whether it is off now or started again', () => {
  const mark = callMarkOf(log())
  expect(() => callsInWindow(mark, log({recording: false}))).toThrow(/stopped/)
  expect(() => callsInWindow(mark, log({generation: 2}))).toThrow(/stopped/)
})

test("the UI's calls leave out the harness's paused ones and other methods", () => {
  expect(uiCallsOf([call('a.b'), call('a.b', true, 6), call('c.d', false, 7)], 'a.b')).toEqual([call('a.b')])
})

test('a window the bounded log dropped calls from throws; one starting at the drop does not', () => {
  const mark = callMarkOf(log())
  expect(() => callsInWindow(mark, log({droppedThrough: 5, seq: 9000}))).toThrow(/lost the window's oldest calls/)
  expect(callsInWindow(mark, log({droppedThrough: 4, seq: 9000}))).toEqual([])
})
