/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle, tick} from '@/test/flush'
import {runProofFlow} from './proofs-list'

afterEach(() => {
  resetAllStores()
})


const startProof = 'keybase.1.prove.startProof'

const startFlow = async (p: {genericService: string | null; proofReason: 'appLink' | 'profile'}) => {
  const fake = installFakeEngine()
  const held = fake.hold(startProof)
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
  await tick()
  const fail = (code: T.RPCGen.StatusCode, desc: string) => held[0]!.reply(fakeError(code, desc))
  return {cancelCurrentRef, done, fail, fake, navigateAppend, navigateUp, setStepSafe}
}

const sessionOf = (fake: FakeEngine) => fake.calls.find(c => c.method === startProof)!.params.sessionID as number

test('a generic proof the service fails shows the failure on the result step', async () => {
  const {done, fail, setStepSafe} = await startFlow({genericService: 'testsite', proofReason: 'profile'})
  fail(T.RPCGen.StatusCode.scgeneric, 'proof not found')
  await done

  expect(setStepSafe).toHaveBeenLastCalledWith(
    expect.objectContaining({error: 'proof not found', kind: 'genericResult'})
  )
})

test('an app link to a service with no proofs leaves for the link error screen', async () => {
  const {done, fail, navigateAppend, navigateUp} = await startFlow({genericService: null, proofReason: 'appLink'})
  fail(T.RPCGen.StatusCode.scgeneric, 'no such service')
  await done

  expect(navigateUp).toHaveBeenCalledTimes(1)
  expect(navigateAppend).toHaveBeenCalledWith(expect.objectContaining({name: 'keybaseLinkError'}))
})

test('a proof the user cancelled shows nothing when its RPC fails', async () => {
  const {cancelCurrentRef, done, fail, fake, setStepSafe} = await startFlow({
    genericService: 'testsite',
    proofReason: 'profile',
  })
  const answered = fake.push(
    'keybase.1.proveUi.promptUsername',
    {parameters: {} as never, prevError: null, prompt: ''},
    {sessionID: sessionOf(fake)}
  )
  await settle()
  setStepSafe.mockClear()

  cancelCurrentRef.current?.()
  expect(await answered).toEqual({
    error: expect.objectContaining({code: T.RPCGen.StatusCode.scinputcanceled}),
  })
  fail(T.RPCGen.StatusCode.scinputcanceled, 'Cancel Add Proof')
  await done

  expect(setStepSafe).not.toHaveBeenCalled()
})
