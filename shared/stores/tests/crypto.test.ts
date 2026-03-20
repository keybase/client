import HiddenString from '../../util/hidden-string'
import {useCurrentUserState} from '../current-user'
import {Operations, useCryptoState} from '../crypto'

const bootstrapCurrentUser = () => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })
}

beforeEach(() => {
  bootstrapCurrentUser()
  useCryptoState.getState().dispatch.resetState()
})

afterEach(() => {
  useCryptoState.getState().dispatch.resetState()
})

test('setInput records text input and triggers the desktop text-operation path', () => {
  const originalDispatch = useCryptoState.getState().dispatch
  const runTextOperation = jest.fn()
  useCryptoState.setState({dispatch: {...originalDispatch, runTextOperation}} as any)

  useCryptoState.getState().dispatch.setInput(Operations.Encrypt, 'text', 'secret message')

  const state = useCryptoState.getState()
  expect(state.encrypt.inputType).toBe('text')
  expect(state.encrypt.input.stringValue()).toBe('secret message')
  expect(state.encrypt.outputValid).toBe(false)
  expect(runTextOperation).toHaveBeenCalledWith(Operations.Encrypt)
})

test('clearRecipients restores encrypt options and recipient metadata', () => {
  const {dispatch} = useCryptoState.getState()

  dispatch.setInput(Operations.Encrypt, 'file', '/tmp/input.saltpack')
  dispatch.setRecipients(['bob', 'carol@twitter'], true)
  dispatch.setEncryptOptions({includeSelf: false, sign: false}, true)
  dispatch.clearRecipients()

  const {encrypt} = useCryptoState.getState()
  expect(encrypt.recipients).toEqual([])
  expect(encrypt.options).toEqual({includeSelf: true, sign: true})
  expect(encrypt.meta).toEqual({hasRecipients: false, hasSBS: false, hideIncludeSelf: false})
})

test('onTeamBuildingFinished hides include-self only for non-SBS self-selection', () => {
  const {dispatch} = useCryptoState.getState()

  dispatch.setInput(Operations.Encrypt, 'file', '/tmp/input.txt')
  dispatch.onTeamBuildingFinished(
    new Set([
      {serviceId: 'keybase', username: 'alice'},
      {serviceId: 'keybase', username: 'bob'},
    ]) as any
  )

  const {encrypt} = useCryptoState.getState()
  expect(encrypt.recipients).toEqual(['alice', 'bob'])
  expect(encrypt.meta.hideIncludeSelf).toBe(true)
  expect(encrypt.options.includeSelf).toBe(false)
  expect(encrypt.meta.hasSBS).toBe(false)
})

test('saltpack progress and completion update operation status for file flows', () => {
  const {dispatch} = useCryptoState.getState()
  useCryptoState.setState({
    decrypt: {
      ...useCryptoState.getState().decrypt,
      outputValid: true,
      output: new HiddenString('old output'),
    },
  } as any)

  dispatch.onSaltpackStart(Operations.Decrypt)
  dispatch.onSaltpackProgress(Operations.Decrypt, 3, 10)

  let decrypt = useCryptoState.getState().decrypt
  expect(decrypt.inProgress).toBe(true)
  expect(decrypt.bytesComplete).toBe(3)
  expect(decrypt.bytesTotal).toBe(10)
  expect(decrypt.outputStatus).toBe('pending')

  dispatch.onSaltpackDone(Operations.Decrypt)

  decrypt = useCryptoState.getState().decrypt
  expect(decrypt.inProgress).toBe(false)
  expect(decrypt.bytesComplete).toBe(0)
  expect(decrypt.bytesTotal).toBe(0)
  expect(decrypt.outputStatus).toBe('pending')
  expect(decrypt.outputValid).toBe(false)
})
