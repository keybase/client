/// <reference types="jest" />
import * as T from '@/constants/types'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle, tick} from '@/test/flush'
import {openURL} from '@/util/misc'
import {runProofFlow, type Step} from './proof-flow'

jest.mock('@/util/misc', () => ({
  ...jest.requireActual<object>('@/util/misc'),
  openURL: jest.fn(async () => Promise.resolve()),
}))

const startProof = 'keybase.1.prove.startProof'
const checkProof = 'keybase.1.prove.checkProof'
const promptUsername = 'keybase.1.proveUi.promptUsername'
const outputInstructions = 'keybase.1.proveUi.outputInstructions'
const checking = 'keybase.1.proveUi.checking'
const continueChecking = 'keybase.1.proveUi.continueChecking'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const sigID = 'sig-1'
const instructions = {data: 'post this', markup: false}
const genericParams: T.RPCGen.ProveParameters = {
  buttonLabel: 'Authorize',
  logoBlack: [{path: 'black.png', width: 16}],
  logoFull: [{path: 'full.png', width: 64}],
  subtext: 'a fediverse server',
  suffix: '@example.social',
  title: 'Example',
}
const linkError =
  "We couldn't find a valid service for proofs in this link. The link might be bad, or your Keybase app might be out of date and need to be updated."

const start = async (
  proofPlatform: string,
  opts?: {onEngineIncoming?: () => void; proofReason?: 'appLink' | 'profile'}
) => {
  const fake = installFakeEngine({onEngineIncoming: opts?.onEngineIncoming})
  const held = fake.hold(startProof)
  fake.answer(checkProof, () => ({found: true, proofText: '', state: 1, status: T.RPCGen.ProofStatus.ok}))
  const steps: Array<Step> = []
  const loadCurrentProfile = jest.fn()
  const navigateAppend = jest.fn()
  const navigateUp = jest.fn()
  const service = T.More.asPlatformsExpandedType(proofPlatform)
  const flow = runProofFlow({
    genericService: service ? null : proofPlatform,
    loadCurrentProfile,
    navigateAppend,
    navigateUp,
    proofPlatform,
    proofReason: opts?.proofReason ?? 'profile',
    service,
    setStep: (s: Step) => steps.push(s),
  })
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const lastStep = () => steps.at(-1)
  return {fake, flow, held, lastStep, loadCurrentProfile, navigateAppend, navigateUp, sessionID, steps}
}

const pushUsername = async (fake: FakeEngine, sessionID: number, extra?: object) =>
  fake.push(promptUsername, {prompt: 'Your username', ...extra}, {sessionID})

afterEach(() => {
  jest.mocked(openURL).mockClear()
})

test('it starts the proof for the platform, telling the service to wait on a posted generic proof', async () => {
  const service = await start('twitter')
  expect(service.fake.calls[0]!.method).toBe(startProof)
  expect(service.fake.calls[0]!.params).toMatchObject({
    auto: false,
    force: true,
    promptPosted: false,
    service: 'twitter',
    username: '',
  })
  service.held[0]!.reply({sigID})
  await service.flow.finished
})

test('the generic proof start sets promptPosted', async () => {
  const generic = await start('example.social')
  expect(generic.fake.calls[0]!.params).toMatchObject({promptPosted: true, service: 'example.social'})
  generic.held[0]!.reply({sigID})
  await generic.flow.finished
})

test('the service checks are answered without asking the user', async () => {
  const {fake, flow, held, sessionID, steps} = await start('twitter')
  const text = {data: 'warning', markup: false}
  await expect(fake.push('keybase.1.proveUi.okToCheck', {attempt: 1, name: 'twitter'}, {sessionID})).resolves.toEqual({
    result: true,
  })
  await expect(fake.push('keybase.1.proveUi.preProofWarning', {text}, {sessionID})).resolves.toEqual({result: true})
  await expect(
    fake.push('keybase.1.proveUi.promptOverwrite', {account: 'testuser', typ: 0}, {sessionID})
  ).resolves.toEqual({result: true})
  await expect(fake.push(checking, {name: 'twitter'}, {sessionID})).resolves.toEqual({result: undefined})
  await expect(fake.push(continueChecking, {}, {sessionID})).resolves.toEqual({result: true})
  // Notices and the service's log are accepted without changing the screen
  await fake.push('keybase.1.proveUi.displayRecheckWarning', {text}, {sessionID})
  await fake.push('keybase.1.proveUi.outputPrechecks', {text}, {sessionID})
  await fake.push('keybase.1.logUi.log', {level: 2, text: {data: 'Success!', markup: false}}, {sessionID})
  await settle()
  expect(steps).toEqual([])
  held[0]!.reply({sigID})
  await flow.finished
})

describe('a service proof', () => {
  test('the username prompt shows the username step and answers with the normalized value', async () => {
    const {fake, flow, held, lastStep, sessionID} = await start('https')
    const answered = pushUsername(fake, sessionID)
    await settle()
    expect(lastStep()).toEqual({error: '', kind: 'enterUsername', platform: 'https', username: ''})
    flow.submitUsername('https://example.com:8080/path')
    await expect(answered).resolves.toEqual({result: 'example.com'})
    held[0]!.reply({sigID})
    await flow.finished
  })

  test('a re-prompt shows the service error with the username already entered', async () => {
    const {fake, flow, held, lastStep, sessionID} = await start('github')
    void pushUsername(fake, sessionID)
    await settle()
    flow.submitUsername('testuser')
    const again = pushUsername(fake, sessionID, {prevError: {code: 1, desc: 'not found', name: 'X'}})
    await settle()
    expect(lastStep()).toEqual({error: 'not found', kind: 'enterUsername', platform: 'github', username: 'testuser'})
    flow.submitUsername('testuser-mac')
    await expect(again).resolves.toEqual({result: 'testuser-mac'})
    held[0]!.reply({sigID})
    await flow.finished
  })

  test('a submit with no prompt open answers nothing', async () => {
    const {fake, flow, held, sessionID} = await start('github')
    const answered = pushUsername(fake, sessionID)
    await settle()
    flow.submitUsername('testuser')
    flow.submitUsername('testuser-mac')
    await expect(answered).resolves.toEqual({result: 'testuser'})
    held[0]!.reply({sigID})
    await flow.finished
  })

  test('the instructions show the post-proof step, and its submit answers them', async () => {
    const {fake, flow, held, lastStep, sessionID} = await start('github')
    void pushUsername(fake, sessionID)
    await settle()
    flow.submitUsername('testuser')
    const instructed = fake.push(outputInstructions, {instructions, proof: 'proof text'}, {sessionID})
    await settle()
    expect(lastStep()).toEqual({
      error: '',
      kind: 'postProof',
      platform: 'github',
      proofText: 'proof text',
      username: 'testuser',
    })
    expect(flow.submitPostProof()).toBe(true)
    await expect(instructed).resolves.toEqual({result: undefined})
    // Answered already: a second submit falls back to checking the proof
    expect(flow.submitPostProof()).toBe(false)
    expect(openURL).not.toHaveBeenCalled()
    held[0]!.reply({sigID})
    await flow.finished
  })

  test.each([
    [{found: true, status: T.RPCGen.ProofStatus.ok}, {kind: 'confirmOrPending', proofFound: true, proofStatus: 1}],
    [
      {found: false, status: T.RPCGen.ProofStatus.baseHardError},
      {error: "We couldn't find your proof. Please retry!", kind: 'postProof', proofText: 'proof text', sigID},
    ],
  ])('after the RPC the proof is checked and the result shown (%j)', async (checked, expected) => {
    const {fake, flow, held, lastStep, loadCurrentProfile, sessionID} = await start('github')
    fake.answer(checkProof, () => ({...checked, proofText: '', state: 1}))
    void pushUsername(fake, sessionID)
    await settle()
    flow.submitUsername('testuser')
    void fake.push(outputInstructions, {instructions, proof: 'proof text'}, {sessionID})
    await settle()
    flow.submitPostProof()
    held[0]!.reply({sigID})
    await flow.finished
    expect(loadCurrentProfile).toHaveBeenCalledTimes(1)
    await settle()
    expect(fake.calls.find(c => c.method === checkProof)!.params).toMatchObject({sigID})
    expect(lastStep()).toEqual({platform: 'github', username: 'testuser', ...expected})
  })

  test('a failed proof check offers a retry', async () => {
    const {fake, flow, held, lastStep} = await start('github')
    fake.answer(checkProof, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'boom'))
    held[0]!.reply({sigID})
    await flow.finished
    await settle()
    expect(lastStep()).toEqual({
      error: "We couldn't verify your proof. Please retry!",
      kind: 'postProof',
      platform: 'github',
      proofText: '',
      sigID,
      username: '',
    })
  })

  test('an app link to an unknown service goes to the link error', async () => {
    const {flow, held, loadCurrentProfile, navigateAppend, navigateUp, steps} = await start('github', {
      proofReason: 'appLink',
    })
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'no such service'))
    await flow.finished
    expect(loadCurrentProfile).toHaveBeenCalledTimes(1)
    expect(navigateUp).toHaveBeenCalledTimes(1)
    expect(navigateAppend).toHaveBeenCalledWith({name: 'keybaseLinkError', params: {error: linkError}})
    expect(steps).toEqual([])
  })

  test('the same error from the profile stays put', async () => {
    const fromProfile = await start('github')
    fromProfile.held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'no such service'))
    await fromProfile.flow.finished
    expect(fromProfile.loadCurrentProfile).toHaveBeenCalledTimes(1)
    expect(fromProfile.navigateAppend).not.toHaveBeenCalled()
    expect(fromProfile.navigateUp).not.toHaveBeenCalled()
  })

  test('another error from an app link stays put', async () => {
    const fromLink = await start('github', {proofReason: 'appLink'})
    fromLink.held[0]!.reply(fakeError(T.RPCGen.StatusCode.scnotfound, 'nope'))
    await fromLink.flow.finished
    expect(fromLink.navigateAppend).not.toHaveBeenCalled()
    expect(fromLink.navigateUp).not.toHaveBeenCalled()
    expect(fromLink.steps).toEqual([])
  })
})

describe('a generic proof', () => {
  test('the username prompt shows the generic step with the service parameters', async () => {
    const {fake, flow, held, lastStep, sessionID} = await start('example.social')
    const answered = pushUsername(fake, sessionID, {parameters: genericParams})
    await settle()
    expect(lastStep()).toEqual({
      error: '',
      genericParams: {
        buttonLabel: 'Authorize',
        logoBlack: genericParams.logoBlack,
        logoFull: genericParams.logoFull,
        subtext: 'a fediverse server',
        suffix: '@example.social',
        title: 'Example',
      },
      kind: 'genericEnterUsername',
      service: 'example.social',
      username: '',
    })
    flow.submitUsername('testuser')
    await expect(answered).resolves.toEqual({result: 'testuser'})
    held[0]!.reply({sigID})
    await flow.finished
  })

  test('the instructions open the proof url and are answered without the user', async () => {
    const {fake, flow, held, lastStep, sessionID} = await start('example.social')
    void pushUsername(fake, sessionID, {parameters: genericParams})
    await settle()
    flow.submitUsername('testuser')
    const url = 'https://example.social/keybase-proof'
    await expect(fake.push(outputInstructions, {instructions, proof: url}, {sessionID})).resolves.toEqual({
      result: undefined,
    })
    expect(openURL).toHaveBeenCalledWith(url)
    expect(lastStep()).toMatchObject({kind: 'genericEnterUsername', proofUrl: url, username: 'testuser'})
    held[0]!.reply({sigID})
    await flow.finished
    expect(lastStep()).toMatchObject({error: '', kind: 'genericResult', username: 'testuser'})
    expect(lastStep()).toMatchObject({genericParams: {title: 'Example'}})
  })

  test('a failure shows the generic result with the error', async () => {
    const {flow, held, lastStep, loadCurrentProfile} = await start('example.social')
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'the server said no'))
    await flow.finished
    expect(loadCurrentProfile).toHaveBeenCalledTimes(1)
    expect(lastStep()).toMatchObject({error: 'the server said no', kind: 'genericResult'})
  })

  test('a failure without a description says the proof failed', async () => {
    const {flow, held, lastStep} = await start('example.social')
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, ''))
    await flow.finished
    expect(lastStep()).toMatchObject({error: 'Failed to verify proof', kind: 'genericResult'})
  })
})

describe('dispose (close, close to profile, unmount)', () => {
  test('refuses the open username prompt', async () => {
    const {fake, flow, held, sessionID} = await start('github')
    const answered = pushUsername(fake, sessionID)
    await settle()
    flow.dialog.dispose()
    await expect(answered).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
    await flow.finished
  })

  test('mid server work refuses the next prompt, without reaching a global answerer', async () => {
    const onEngineIncoming = jest.fn()
    const {fake, flow, held, sessionID} = await start('github', {onEngineIncoming})
    void pushUsername(fake, sessionID)
    await settle()
    flow.submitUsername('testuser')
    void fake.push(outputInstructions, {instructions, proof: 'proof text'}, {sessionID})
    await settle()
    flow.submitPostProof()
    flow.dialog.dispose()
    await expect(fake.push(checking, {name: 'github'}, {sessionID})).resolves.toEqual({error: inputCanceled})
    await expect(fake.push(continueChecking, {}, {sessionID})).resolves.toEqual({error: inputCanceled})
    expect(onEngineIncoming).not.toHaveBeenCalled()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await flow.finished
  })

  test('ends the run at once with no step or navigation, but still reloads the profile', async () => {
    const {flow, held, loadCurrentProfile, navigateAppend, navigateUp, steps} = await start('github', {
      proofReason: 'appLink',
    })
    let ended = false
    void flow.finished.then(() => {
      ended = true
    })
    flow.dialog.dispose()
    await tick()
    expect(ended).toBe(true)
    expect(loadCurrentProfile).toHaveBeenCalledTimes(1)
    expect(steps).toEqual([])
    expect(navigateAppend).not.toHaveBeenCalled()
    expect(navigateUp).not.toHaveBeenCalled()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'late'))
    await settle()
    expect(navigateUp).not.toHaveBeenCalled()
  })

  test('a disposed generic proof shows no result', async () => {
    const {flow, held, steps} = await start('example.social')
    flow.dialog.dispose()
    await flow.finished
    held[0]!.reply(undefined)
    await settle()
    expect(steps).toEqual([])
  })

  test('after the RPC succeeded but before the run ends, shows no result and checks no proof', async () => {
    const {fake, flow, held, loadCurrentProfile, steps} = await start('github')
    held[0]!.reply({sigID})
    // The events end a timer after done resolves; this disposes in between
    await flow.dialog.done
    flow.dialog.dispose()
    await flow.finished
    await settle()
    expect(loadCurrentProfile).toHaveBeenCalledTimes(1)
    expect(steps).toEqual([])
    expect(fake.calls.some(c => c.method === checkProof)).toBe(false)
  })
})
