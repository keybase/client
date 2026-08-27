/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as RPCGen from '@/constants/rpc/rpc-gen'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {useCurrentUserState} from '@/stores/current-user'
import {useDecryptState} from './decrypt'
import {useSignState} from './sign'
import {useVerifyState} from './verify'

beforeEach(() => {
  useCurrentUserState.setState({username: 'testuser'} as never)
})

// RPCError deliberately does not extend Error, so a rejection with one has to
// be built in a single place the lint rule can be told about.
const rejectWithRPCError = async (code: RPCGen.StatusCode): Promise<never> => {
  await Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new RPCError('nope', code)
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  useCurrentUserState.getState().dispatch.resetState()
})

test('a decrypt failure clears the output and shows the mapped status message', async () => {
  jest.spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise').mockImplementation(async () => rejectWithRPCError(RPCGen.StatusCode.scstreamunknown))

  const {result} = renderHook(() => useDecryptState())
  act(() => {
    result.current.setInput('text', 'not saltpack')
  })

  await waitFor(() => expect(result.current.state.errorMessage).not.toBe(''))
  expect(result.current.state.errorMessage).toBe(
    'This ciphertext is not in a valid Saltpack format. Please enter Saltpack ciphertext.'
  )
  expect(result.current.state.output).toBe('')
  expect(result.current.state.outputStatus).toBeUndefined()
  expect(result.current.state.inProgress).toBe(false)
})

test('a verify failure explains it may be an encrypted message instead', async () => {
  jest.spyOn(T.RPCGen, 'saltpackSaltpackVerifyStringRpcPromise').mockImplementation(async () => rejectWithRPCError(RPCGen.StatusCode.scwrongcryptomsgtype))

  const {result} = renderHook(() => useVerifyState())
  act(() => {
    result.current.setInput('text', 'ciphertext, not a signed message')
  })

  await waitFor(() => expect(result.current.state.errorMessage).not.toBe(''))
  expect(result.current.state.errorMessage).toBe(
    'This Saltpack format is unexpected. Did you mean to decrypt it?'
  )
})

test('a decrypt error message is cleared by the next input', async () => {
  const decryptSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise')
    .mockImplementationOnce(async () => rejectWithRPCError(RPCGen.StatusCode.scstreamunknown))
    .mockImplementation(async () =>
      Promise.resolve({
        info: {sender: {fullname: 'Test User Mac', username: 'testuser-mac'}},
        plaintext: 'plain',
        signed: true,
      } as never)
    )

  const {result} = renderHook(() => useDecryptState())
  act(() => {
    result.current.setInput('text', 'bad')
  })
  await waitFor(() => expect(result.current.state.errorMessage).not.toBe(''))

  act(() => {
    result.current.setInput('text', 'good')
  })

  await waitFor(() => expect(result.current.state.output).toBe('plain'))
  expect(result.current.state.errorMessage).toBe('')
  expect(decryptSpy).toHaveBeenCalledTimes(2)
})

test('an unsigned decrypt does not attribute the plaintext to a sender', async () => {
  jest.spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise').mockImplementation(async () =>
    Promise.resolve({
      info: {sender: {fullname: 'Test User Mac', username: 'testuser-mac'}},
      plaintext: 'plain',
      signed: false,
    } as never)
  )

  const {result} = renderHook(() => useDecryptState())
  act(() => {
    result.current.setInput('text', 'anonymous ciphertext')
  })

  await waitFor(() => expect(result.current.state.output).toBe('plain'))
  expect(result.current.state.outputSigned).toBe(false)
  expect(result.current.state.outputSenderUsername).toBeUndefined()
  expect(result.current.state.outputSenderFullname).toBeUndefined()
})

test('a signed decrypt keeps the sender for the output header', async () => {
  jest.spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise').mockImplementation(async () =>
    Promise.resolve({
      info: {sender: {fullname: 'Test User Mac', username: 'testuser-mac'}},
      plaintext: 'plain',
      signed: true,
    } as never)
  )

  const {result} = renderHook(() => useDecryptState())
  act(() => {
    result.current.setInput('text', 'signed ciphertext')
  })

  await waitFor(() => expect(result.current.state.output).toBe('plain'))
  expect(result.current.state.outputSenderUsername).toBe('testuser-mac')
  expect(result.current.state.outputSenderFullname).toBe('Test User Mac')
})

test('a file input does not auto-run and uses the file RPC when run explicitly', async () => {
  const stringSpy = jest.spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise')
  const fileSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackDecryptFileRpcPromise')
    .mockImplementation(async () =>
      Promise.resolve({
        decryptedFilename: '/tmp/out.txt',
        info: {sender: {fullname: 'Test User Mac', username: 'testuser-mac'}},
        signed: true,
      } as never)
    )

  const {result} = renderHook(() => useDecryptState())
  act(() => {
    result.current.openFile('/tmp/in.encrypted')
  })

  expect(result.current.state.inputType).toBe('file')
  expect(fileSpy).not.toHaveBeenCalled()
  expect(stringSpy).not.toHaveBeenCalled()

  await act(async () => {
    await result.current.decrypt('/tmp/dest')
  })

  expect(fileSpy).toHaveBeenCalledWith(
    expect.objectContaining({destinationDir: '/tmp/dest', encryptedFilename: '/tmp/in.encrypted'}),
    expect.anything()
  )
  expect(result.current.state.output).toBe('/tmp/out.txt')
  expect(result.current.state.outputType).toBe('file')
})

test('openFile is ignored while an operation is already running', async () => {
  let release: (() => void) | undefined
  jest.spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise').mockImplementation(
    async () =>
      new Promise(resolve => {
        release = () =>
          resolve({
            info: {sender: {fullname: '', username: 'testuser-mac'}},
            plaintext: 'plain',
            signed: false,
          } as never)
      })
  )

  const {result} = renderHook(() => useDecryptState())
  act(() => {
    result.current.setInput('text', 'slow ciphertext')
  })
  await waitFor(() => expect(result.current.state.inProgress).toBe(true))

  act(() => {
    result.current.openFile('/tmp/late.encrypted')
  })
  expect(result.current.state.inputType).toBe('text')
  expect(result.current.state.input).toBe('slow ciphertext')

  await act(async () => {
    release?.()
    await Promise.resolve()
  })
})

test('a result for superseded input is not marked valid for the current input', async () => {
  const pending: Array<(value: never) => void> = []
  jest.spyOn(T.RPCGen, 'saltpackSaltpackSignStringRpcPromise').mockImplementation(
    async () =>
      new Promise(resolve => {
        pending.push(resolve)
      })
  )

  const {result} = renderHook(() => useSignState())
  act(() => {
    result.current.setInput('text', 'first')
  })
  act(() => {
    result.current.setInput('text', 'second')
  })
  expect(pending).toHaveLength(2)

  // the run for the superseded 'first' input lands
  await act(async () => {
    pending[0]?.('signed:first' as never)
    await Promise.resolve()
  })
  expect(result.current.state.outputValid).toBe(false)

  // the run for the input actually on screen lands
  await act(async () => {
    pending[1]?.('signed:second' as never)
    await Promise.resolve()
  })
  expect(result.current.state.output).toBe('signed:second')
  expect(result.current.state.outputValid).toBe(true)
})

test('a seeded text route param runs the operation on mount', async () => {
  const signSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackSignStringRpcPromise')
    .mockImplementation(async () => Promise.resolve('signed' as never))

  const {result} = renderHook(() => useSignState({seedInputPath: 'seeded text', seedInputType: 'text'}))

  await waitFor(() => expect(signSpy).toHaveBeenCalled())
  expect(signSpy).toHaveBeenCalledWith(
    expect.objectContaining({plaintext: 'seeded text'}),
    expect.anything()
  )
  await waitFor(() => expect(result.current.state.output).toBe('signed'))
})

test('a seeded file route param loads the file without running it', () => {
  const signSpy = jest.spyOn(T.RPCGen, 'saltpackSaltpackSignFileRpcPromise')
  const {result} = renderHook(() => useSignState({seedInputPath: '/tmp/in.txt', seedInputType: 'file'}))

  expect(result.current.state.input).toBe('/tmp/in.txt')
  expect(result.current.state.inputType).toBe('file')
  expect(signSpy).not.toHaveBeenCalled()
})

test('a superseded decrypt cannot commit over the run that replaced it', async () => {
  // first call hangs until we release it, so the second (newer) run finishes first
  let releaseFirst = (_: unknown) => {}
  const firstPending = new Promise(resolve => {
    releaseFirst = resolve
  })
  jest
    .spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise')
    .mockImplementationOnce(async () => {
      await firstPending
      return {
        info: {sender: {fullname: 'Stale Sender', username: 'stale-sender'}},
        plaintext: 'STALE PLAINTEXT',
        signed: true,
      } as never
    })
    .mockImplementationOnce(async () => {
      await Promise.resolve()
      return {
        info: {sender: {fullname: 'Test User Mac', username: 'testuser-mac'}},
        plaintext: 'FRESH PLAINTEXT',
        signed: true,
      } as never
    })

  const {result} = renderHook(() => useDecryptState())
  act(() => {
    result.current.setInput('text', 'first ciphertext')
  })
  act(() => {
    result.current.setInput('text', 'second ciphertext')
  })

  await waitFor(() => expect(result.current.state.output).toBe('FRESH PLAINTEXT'))

  await act(async () => {
    releaseFirst(undefined)
    await firstPending
  })

  expect(result.current.state.output).toBe('FRESH PLAINTEXT')
  expect(result.current.state.outputSenderUsername).toBe('testuser-mac')
  expect(result.current.state.outputValid).toBe(true)
})
