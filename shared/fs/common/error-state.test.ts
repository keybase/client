/// <reference types="jest" />
import * as T from '@/constants/types'
import {errorToActionOrThrowWithHandlers} from './error-state'

const p = (s: string) => T.FS.stringToPath(s)
const filePath = p('/keybase/private/testuser/a.txt')
const tlfPath = p('/keybase/private/testuser')

const makeHandlers = () => ({
  checkKbfsDaemonRpcStatus: jest.fn(),
  redbar: jest.fn(),
  setPathSoftError: jest.fn(),
  setTlfSoftError: jest.fn(),
})

const noneCalled = (handlers: ReturnType<typeof makeHandlers>) =>
  Object.values(handlers).every(fn => fn.mock.calls.length === 0)

test('non-object errors are swallowed rather than thrown', () => {
  const handlers = makeHandlers()
  expect(() => errorToActionOrThrowWithHandlers(handlers, 'a string', filePath)).not.toThrow()
  expect(() => errorToActionOrThrowWithHandlers(handlers, undefined, filePath)).not.toThrow()
  expect(noneCalled(handlers)).toBe(true)
})

test('identify failures are ignored on purpose', () => {
  const handlers = makeHandlers()
  errorToActionOrThrowWithHandlers(
    handlers,
    {code: T.RPCGen.StatusCode.scidentifiesfailed},
    filePath
  )
  expect(noneCalled(handlers)).toBe(true)
})

test('a kbfs client timeout re-checks the daemon and nothing else', () => {
  const handlers = makeHandlers()
  errorToActionOrThrowWithHandlers(
    handlers,
    {code: T.RPCGen.StatusCode.sckbfsclienttimeout},
    filePath
  )
  expect(handlers.checkKbfsDaemonRpcStatus).toHaveBeenCalledTimes(1)
  expect(handlers.redbar).not.toHaveBeenCalled()
  expect(handlers.setPathSoftError).not.toHaveBeenCalled()
  expect(handlers.setTlfSoftError).not.toHaveBeenCalled()
})

test('a not-exist error with a path becomes a nonexistent soft error on that path', () => {
  const handlers = makeHandlers()
  errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scsimplefsnotexist}, filePath)
  expect(handlers.setPathSoftError).toHaveBeenCalledWith(filePath, T.FS.SoftError.Nonexistent)
  // it is the path itself, not the tlf root
  expect(handlers.setTlfSoftError).not.toHaveBeenCalled()
  expect(handlers.checkKbfsDaemonRpcStatus).not.toHaveBeenCalled()
})

test('a deleted-user error shows a redbar rather than throwing', () => {
  const handlers = makeHandlers()
  errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scdeleted}, filePath)
  expect(handlers.redbar).toHaveBeenCalledWith('A user in this shared folder has deleted their account.')
  expect(handlers.setPathSoftError).not.toHaveBeenCalled()
  expect(handlers.setTlfSoftError).not.toHaveBeenCalled()
})

test('a deleted-user error is handled even without a path', () => {
  const handlers = makeHandlers()
  expect(() =>
    errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scdeleted})
  ).not.toThrow()
  expect(handlers.redbar).toHaveBeenCalledTimes(1)
})

test('every no-access code maps to a tlf soft error on the tlf root', () => {
  for (const code of [
    T.RPCGen.StatusCode.scsimplefsnoaccess,
    T.RPCGen.StatusCode.scteamnotfound,
    T.RPCGen.StatusCode.scteamreaderror,
  ]) {
    const handlers = makeHandlers()
    errorToActionOrThrowWithHandlers(handlers, {code}, filePath)
    expect(handlers.setTlfSoftError).toHaveBeenCalledWith(tlfPath, T.FS.SoftError.NoAccess)
    expect(handlers.setPathSoftError).not.toHaveBeenCalled()
  }
})

test('a no-access error without a resolvable tlf path is rethrown', () => {
  const handlers = makeHandlers()
  expect(() =>
    errorToActionOrThrowWithHandlers(
      handlers,
      {code: T.RPCGen.StatusCode.scsimplefsnoaccess},
      p('/keybase/private')
    )
  ).toThrow()
  expect(handlers.setTlfSoftError).not.toHaveBeenCalled()
})

test('soft path errors need a path; without one the error escapes', () => {
  const handlers = makeHandlers()
  expect(() =>
    errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scsimplefsnotexist})
  ).toThrow()
  expect(handlers.setPathSoftError).not.toHaveBeenCalled()
})

test('unhandled errors are rethrown as real Errors', () => {
  const handlers = makeHandlers()
  expect(() =>
    errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scgeneric, desc: 'boom'}, filePath)
  ).toThrow(Error)
  // an object with no code at all is still an error
  expect(() => errorToActionOrThrowWithHandlers(handlers, {}, filePath)).toThrow(Error)
})
