/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {installListenerEngine, uninstallListenerEngine} from '@/test/fake-listener-engine'
import {runProofFlow} from './proofs-list'

afterEach(() => {
  uninstallListenerEngine()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))
// The listener hands prompts to their handlers a tick after they arrive.
const tick = async () => new Promise<void>(resolve => setTimeout(resolve, 0))

const startFlow = (p: {genericService: string | null; proofReason: 'appLink' | 'profile'}) => {
  const engine = installListenerEngine()
  const setStepSafe = jest.fn()
  const navigateAppend = jest.fn()
  const navigateUp = jest.fn()
  const cancelCurrentRef = {current: undefined as undefined | (() => void)}
  const done = runProofFlow({
    afterCheckProofRef: {current: undefined},
    cancelCurrentRef,
    currentGenericParamsRef: {current: {} as never},
    currentUsernameRef: {current: ''},
    genericService: p.genericService,
    loadCurrentProfile: jest.fn(),
    mountedRef: {current: true},
    navigateAppend: navigateAppend as never,
    navigateUp: navigateUp as never,
    proofPlatform: p.genericService ?? 'twitter',
    proofReason: p.proofReason,
    resetSession: jest.fn(),
    service: p.genericService ? undefined : 'twitter',
    setStepSafe,
    submitUsernameRef: {current: undefined},
  })
  return {cancelCurrentRef, done, engine, navigateAppend, navigateUp, setStepSafe}
}

test('a generic proof the service fails shows the failure on the result step', async () => {
  const {done, engine, setStepSafe} = startFlow({genericService: 'testsite', proofReason: 'profile'})
  engine.fail('keybase.1.prove.startProof', T.RPCGen.StatusCode.scgeneric, 'proof not found')
  await done

  expect(setStepSafe).toHaveBeenLastCalledWith(
    expect.objectContaining({error: 'proof not found', kind: 'genericResult'})
  )
})

test('an app link to a service with no proofs leaves for the link error screen', async () => {
  const {done, engine, navigateAppend, navigateUp} = startFlow({genericService: null, proofReason: 'appLink'})
  engine.fail('keybase.1.prove.startProof', T.RPCGen.StatusCode.scgeneric, 'no such service')
  await done

  expect(navigateUp).toHaveBeenCalledTimes(1)
  expect(navigateAppend).toHaveBeenCalledWith(expect.objectContaining({name: 'keybaseLinkError'}))
})

test('a proof the user cancelled shows nothing when its RPC fails', async () => {
  const {cancelCurrentRef, done, engine, setStepSafe} = startFlow({
    genericService: 'testsite',
    proofReason: 'profile',
  })
  const response = {error: jest.fn(), result: jest.fn()}
  engine.pending('keybase.1.prove.startProof').incomingCallMap['keybase.1.proveUi.promptUsername']?.(
    {parameters: {} as never, prevError: null, prompt: '', sessionID: 0},
    response
  )
  await tick()
  await flush()
  setStepSafe.mockClear()

  cancelCurrentRef.current?.()
  expect(response.error).toHaveBeenCalledWith(
    expect.objectContaining({code: T.RPCGen.StatusCode.scinputcanceled})
  )
  engine.fail('keybase.1.prove.startProof', T.RPCGen.StatusCode.scinputcanceled, 'Cancel Add Proof')
  await done

  expect(setStepSafe).not.toHaveBeenCalled()
})
