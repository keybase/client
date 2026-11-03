import {nextRecordingAction} from './recorder-lib'

test('a recording is taken from the runtime it started in', () => {
  expect(nextRecordingAction('a', 'a')).toBe('take')
})

test('a different runtime restarts the recording', () => {
  expect(nextRecordingAction('a', 'b')).toBe('restart')
})

test('a runtime that has not loaded yet is waited for', () => {
  expect(nextRecordingAction('a', undefined)).toBe('wait')
})
