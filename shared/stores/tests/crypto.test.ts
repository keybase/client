import * as T from '@/constants/types'
import logger from '@/logger'
import HiddenString from '@/util/hidden-string'
import RPCError from '@/util/rpcerror'
import {resetAllStores} from '@/util/zustand'
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

const flushPromises = async () => new Promise<void>(resolve => setImmediate(resolve))

const makeCommonState = (
  overrides: Partial<{
    bytesComplete: number
    bytesTotal: number
    errorMessage: string
    inProgress: boolean
    input: string
    inputType: 'text' | 'file'
    output: string
    outputFileDestination: string
    outputSenderFullname?: string
    outputSenderUsername?: string
    outputSigned: boolean
    outputStatus?: 'success' | 'pending' | 'error'
    outputType?: 'text' | 'file'
    outputValid: boolean
    warningMessage: string
  }> = {}
) => ({
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: '',
  inProgress: false,
  input: '',
  inputType: 'text' as const,
  output: '',
  outputFileDestination: '',
  outputSenderFullname: undefined,
  outputSenderUsername: undefined,
  outputSigned: false,
  outputStatus: undefined,
  outputType: undefined,
  outputValid: false,
  warningMessage: '',
  ...overrides,
})

const makeEncryptState = (
  overrides: Partial<
    ReturnType<typeof makeCommonState> & {
      meta: {hasRecipients: boolean; hasSBS: boolean; hideIncludeSelf: boolean}
      options: {includeSelf: boolean; sign: boolean}
      recipients: Array<string>
    }
  > = {}
) => ({
  ...makeCommonState(),
  meta: {hasRecipients: false, hasSBS: false, hideIncludeSelf: false},
  options: {includeSelf: true, sign: true},
  recipients: [] as Array<string>,
  ...overrides,
})

const getOperationState = (operation: T.Crypto.Operations) => {
  const o = useCryptoState.getState()[operation]
  return {
    bytesComplete: o.bytesComplete,
    bytesTotal: o.bytesTotal,
    errorMessage: o.errorMessage.stringValue(),
    inProgress: o.inProgress,
    input: o.input.stringValue(),
    inputType: o.inputType,
    output: o.output.stringValue(),
    outputFileDestination: o.outputFileDestination.stringValue(),
    outputSenderFullname: o.outputSenderFullname?.stringValue(),
    outputSenderUsername: o.outputSenderUsername?.stringValue(),
    outputSigned: o.outputSigned,
    outputStatus: o.outputStatus,
    outputType: o.outputType,
    outputValid: o.outputValid,
    warningMessage: o.warningMessage.stringValue(),
  }
}

const getPublicState = () => {
  const encrypt = useCryptoState.getState().encrypt
  return {
    decrypt: getOperationState(Operations.Decrypt),
    encrypt: {
      ...getOperationState(Operations.Encrypt),
      meta: {...encrypt.meta},
      options: {...encrypt.options},
      recipients: [...encrypt.recipients],
    },
    sign: getOperationState(Operations.Sign),
    verify: getOperationState(Operations.Verify),
  }
}

const getDefaultPublicState = () => ({
  decrypt: makeCommonState(),
  encrypt: makeEncryptState(),
  sign: makeCommonState(),
  verify: makeCommonState(),
})

const setOperationInput = (operation: T.Crypto.Operations, inputType: 'text' | 'file', input: string) => {
  useCryptoState.setState(s => {
    const o = s[operation]
    o.inputType = inputType
    o.input = new HiddenString(input)
  })
}

const dispatchKeys = [
  'clearInput',
  'clearRecipients',
  'downloadEncryptedText',
  'downloadSignedText',
  'onSaltpackDone',
  'onSaltpackOpenFile',
  'onSaltpackProgress',
  'onSaltpackStart',
  'onTeamBuildingFinished',
  'resetOperation',
  'resetState',
  'runFileOperation',
  'runTextOperation',
  'setEncryptOptions',
  'setInput',
  'setRecipients',
].sort()

beforeEach(() => {
  jest.spyOn(logger, 'error').mockImplementation(() => undefined)
  resetAllStores()
  bootstrapCurrentUser()
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('resetState restores the full public store surface to defaults', () => {
  const runTextOperation = jest.fn()
  useCryptoState.setState(s => {
    s.dispatch.runTextOperation = runTextOperation
  })

  const {dispatch} = useCryptoState.getState()
  dispatch.onSaltpackOpenFile(Operations.Encrypt, '/tmp/plain.txt')
  dispatch.onSaltpackOpenFile(Operations.Decrypt, '/tmp/ciphertext.saltpack')
  dispatch.onSaltpackStart(Operations.Decrypt)
  dispatch.onSaltpackProgress(Operations.Decrypt, 3, 10)
  dispatch.setRecipients(['bob'], false)
  dispatch.setEncryptOptions({includeSelf: false, sign: false}, true)
  dispatch.setInput(Operations.Verify, 'text', 'signed message')

  expect(runTextOperation).toHaveBeenCalledWith(Operations.Verify)
  expect(getPublicState()).not.toEqual(getDefaultPublicState())

  dispatch.resetState()

  expect(Object.keys(useCryptoState.getState().dispatch).sort()).toEqual(dispatchKeys)
  expect(getPublicState()).toEqual(getDefaultPublicState())
})

test('encrypt supports file and text flows, downloads, and clearing state', async () => {
  const encryptFile = jest.spyOn(T.RPCGen, 'saltpackSaltpackEncryptFileRpcPromise').mockResolvedValue({
    filename: '/tmp/plain.txt.encrypted.saltpack',
    unresolvedSBSAssertion: '[carol]@email',
    usedUnresolvedSBS: true,
  } as any)
  const encryptString = jest.spyOn(T.RPCGen, 'saltpackSaltpackEncryptStringRpcPromise').mockResolvedValue({
    ciphertext: 'ciphertext',
    unresolvedSBSAssertion: '',
    usedUnresolvedSBS: false,
  } as any)
  const saveCiphertext = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackSaveCiphertextToFileRpcPromise')
    .mockResolvedValue('/tmp/ciphertext.saltpack' as any)

  const {dispatch} = useCryptoState.getState()

  dispatch.onSaltpackOpenFile(Operations.Encrypt, '/tmp/plain.txt')
  dispatch.setRecipients(['[carol]@email'], true)
  dispatch.runFileOperation(Operations.Encrypt, '/tmp/out')
  await flushPromises()

  expect(encryptFile).toHaveBeenCalledWith(
    {
      destinationDir: '/tmp/out',
      filename: '/tmp/plain.txt',
      opts: {
        includeSelf: true,
        recipients: ['[carol]@email'],
        signed: true,
      },
    },
    expect.any(String)
  )
  expect(getPublicState().encrypt).toEqual(
    makeEncryptState({
      input: '/tmp/plain.txt',
      inputType: 'file',
      meta: {hasRecipients: true, hasSBS: true, hideIncludeSelf: false},
      options: {includeSelf: true, sign: true},
      output: '/tmp/plain.txt.encrypted.saltpack',
      outputSenderFullname: '',
      outputSenderUsername: 'alice',
      outputSigned: true,
      outputStatus: 'success',
      outputType: 'file',
      outputValid: true,
      recipients: ['[carol]@email'],
      warningMessage:
        'Note: Encrypted for "[carol]@email" who is not yet a Keybase user. One of your devices will need to be online after they join Keybase in order for them to decrypt the message.',
    })
  )

  dispatch.clearRecipients()
  expect(getPublicState().encrypt).toEqual(
    makeEncryptState({
      input: '/tmp/plain.txt',
      inputType: 'file',
    })
  )

  dispatch.onSaltpackOpenFile(Operations.Encrypt, '/tmp/plain.txt')
  dispatch.setRecipients(['bob'], false)
  dispatch.setEncryptOptions({includeSelf: false, sign: false}, true)
  dispatch.setInput(Operations.Encrypt, 'text', 'secret message')
  await flushPromises()

  expect(encryptString).toHaveBeenCalledWith(
    {
      opts: {
        includeSelf: false,
        recipients: ['bob'],
        signed: false,
      },
      plaintext: 'secret message',
    },
    expect.any(String)
  )
  expect(getPublicState().encrypt).toEqual(
    makeEncryptState({
      input: 'secret message',
      meta: {hasRecipients: true, hasSBS: false, hideIncludeSelf: true},
      options: {includeSelf: false, sign: false},
      output: 'ciphertext',
      outputSenderFullname: '',
      outputSenderUsername: '',
      outputSigned: false,
      outputStatus: 'success',
      outputType: 'text',
      outputValid: true,
      recipients: ['bob'],
    })
  )

  dispatch.downloadEncryptedText()
  await flushPromises()

  expect(saveCiphertext).toHaveBeenCalledWith({ciphertext: 'ciphertext'})
  expect(getPublicState().encrypt).toEqual(
    makeEncryptState({
      input: 'secret message',
      meta: {hasRecipients: true, hasSBS: false, hideIncludeSelf: true},
      options: {includeSelf: false, sign: false},
      output: '/tmp/ciphertext.saltpack',
      outputSenderFullname: '',
      outputSenderUsername: '',
      outputSigned: false,
      outputStatus: 'success',
      outputType: 'file',
      outputValid: true,
      recipients: ['bob'],
    })
  )

  dispatch.clearInput(Operations.Encrypt)
  expect(getPublicState().encrypt).toEqual(
    makeEncryptState({
      meta: {hasRecipients: true, hasSBS: false, hideIncludeSelf: true},
      options: {includeSelf: false, sign: false},
      outputValid: true,
      recipients: ['bob'],
    })
  )
})

test('progress, open-file, team building, and resetOperation cover the remaining UI-driven state transitions', () => {
  const {dispatch} = useCryptoState.getState()

  useCryptoState.setState(s => {
    s.decrypt.output = new HiddenString('stale output')
    s.decrypt.outputStatus = 'success'
    s.decrypt.outputValid = true
  })
  dispatch.onSaltpackOpenFile(Operations.Decrypt, '/tmp/ciphertext.saltpack')
  expect(getPublicState().decrypt).toEqual(
    makeCommonState({
      input: '/tmp/ciphertext.saltpack',
      inputType: 'file',
    })
  )

  dispatch.onSaltpackStart(Operations.Decrypt)
  dispatch.onSaltpackOpenFile(Operations.Decrypt, '/tmp/ignored.saltpack')
  dispatch.onSaltpackProgress(Operations.Decrypt, 3, 10)
  expect(getPublicState().decrypt).toEqual(
    makeCommonState({
      bytesComplete: 3,
      bytesTotal: 10,
      inProgress: true,
      input: '/tmp/ciphertext.saltpack',
      inputType: 'file',
      outputStatus: 'pending',
    })
  )

  dispatch.onSaltpackProgress(Operations.Decrypt, 10, 10)
  dispatch.onSaltpackDone(Operations.Decrypt)
  expect(getPublicState().decrypt).toEqual(
    makeCommonState({
      input: '/tmp/ciphertext.saltpack',
      inputType: 'file',
      outputStatus: 'pending',
    })
  )

  dispatch.onSaltpackOpenFile(Operations.Encrypt, '/tmp/plain.txt')
  useCryptoState.setState(s => {
    s.encrypt.output = new HiddenString('stale output')
    s.encrypt.outputStatus = 'success'
    s.encrypt.outputValid = true
    s.encrypt.warningMessage = new HiddenString('stale warning')
  })
  dispatch.onTeamBuildingFinished(
    new Set([
      {serviceId: 'keybase', username: 'alice'},
      {serviceId: 'keybase', username: 'bob'},
    ]) as any
  )
  expect(getPublicState().encrypt).toEqual(
    makeEncryptState({
      input: '/tmp/plain.txt',
      inputType: 'file',
      meta: {hasRecipients: true, hasSBS: false, hideIncludeSelf: true},
      options: {includeSelf: false, sign: true},
      recipients: ['alice', 'bob'],
    })
  )

  dispatch.resetOperation(Operations.Encrypt)
  expect(getPublicState().encrypt).toEqual(makeEncryptState())

  dispatch.onSaltpackOpenFile(Operations.Encrypt, '/tmp/plain.txt')
  dispatch.onTeamBuildingFinished(
    new Set([
      {serviceId: 'keybase', username: 'alice'},
      {serviceId: 'email', username: 'carol'},
    ]) as any
  )
  expect(getPublicState().encrypt).toEqual(
    makeEncryptState({
      input: '/tmp/plain.txt',
      inputType: 'file',
      meta: {hasRecipients: true, hasSBS: true, hideIncludeSelf: false},
      options: {includeSelf: true, sign: true},
      recipients: ['alice', '[carol]@email'],
    })
  )
})

test('decrypt supports text and file flows and maps crypto-specific errors', async () => {
  const decryptString = jest.spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise').mockResolvedValue({
    info: {sender: {fullname: 'Bob', username: 'bob'}},
    plaintext: 'hello',
    signed: true,
  } as any)
  const decryptFile = jest.spyOn(T.RPCGen, 'saltpackSaltpackDecryptFileRpcPromise').mockResolvedValue({
    decryptedFilename: '/tmp/plain.txt',
    info: {sender: {fullname: '', username: ''}},
    signed: false,
  } as any)

  const {dispatch} = useCryptoState.getState()

  setOperationInput(Operations.Decrypt, 'text', 'ciphertext')
  dispatch.runTextOperation(Operations.Decrypt)
  await flushPromises()

  expect(decryptString).toHaveBeenCalledWith({ciphertext: 'ciphertext'}, expect.any(String))
  expect(getPublicState().decrypt).toEqual(
    makeCommonState({
      input: 'ciphertext',
      output: 'hello',
      outputSenderFullname: 'Bob',
      outputSenderUsername: 'bob',
      outputSigned: true,
      outputStatus: 'success',
      outputType: 'text',
      outputValid: true,
    })
  )

  dispatch.resetOperation(Operations.Decrypt)
  dispatch.onSaltpackOpenFile(Operations.Decrypt, '/tmp/ciphertext.saltpack')
  dispatch.runFileOperation(Operations.Decrypt, '/tmp/out')
  await flushPromises()

  expect(decryptFile).toHaveBeenCalledWith(
    {
      destinationDir: '/tmp/out',
      encryptedFilename: '/tmp/ciphertext.saltpack',
    },
    expect.any(String)
  )
  expect(getPublicState().decrypt).toEqual(
    makeCommonState({
      input: '/tmp/ciphertext.saltpack',
      inputType: 'file',
      output: '/tmp/plain.txt',
      outputSenderFullname: '',
      outputSenderUsername: '',
      outputSigned: false,
      outputStatus: 'success',
      outputType: 'file',
      outputValid: true,
    })
  )

  decryptString.mockRejectedValueOnce(
    new RPCError('decrypt failed', T.RPCGen.StatusCode.scdecryptionerror, [
      {key: 'ignored', value: T.RPCGen.StatusCode.scgeneric},
      {key: 'Code', value: T.RPCGen.StatusCode.scwrongcryptomsgtype},
    ])
  )
  setOperationInput(Operations.Decrypt, 'text', 'bad ciphertext')
  dispatch.runTextOperation(Operations.Decrypt)
  await flushPromises()

  expect(getPublicState().decrypt).toEqual(
    makeCommonState({
      errorMessage: 'This Saltpack format is unexpected. Did you mean to verify it?',
      input: 'bad ciphertext',
    })
  )
})

test('sign supports text and file flows, downloads, and offline errors', async () => {
  const signString = jest.spyOn(T.RPCGen, 'saltpackSaltpackSignStringRpcPromise').mockResolvedValue(
    'signed message' as any
  )
  const signFile = jest.spyOn(T.RPCGen, 'saltpackSaltpackSignFileRpcPromise').mockResolvedValue(
    '/tmp/plain.txt.signed.saltpack' as any
  )
  const saveSigned = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackSaveSignedMsgToFileRpcPromise')
    .mockResolvedValue('/tmp/signed-message.saltpack' as any)

  const {dispatch} = useCryptoState.getState()

  setOperationInput(Operations.Sign, 'text', 'hello')
  dispatch.runTextOperation(Operations.Sign)
  await flushPromises()

  expect(signString).toHaveBeenCalledWith({plaintext: 'hello'}, expect.any(String))
  expect(getPublicState().sign).toEqual(
    makeCommonState({
      input: 'hello',
      output: 'signed message',
      outputSenderFullname: '',
      outputSenderUsername: 'alice',
      outputSigned: true,
      outputStatus: 'success',
      outputType: 'text',
      outputValid: true,
    })
  )

  dispatch.downloadSignedText()
  await flushPromises()

  expect(saveSigned).toHaveBeenCalledWith({signedMsg: 'signed message'})
  expect(getPublicState().sign).toEqual(
    makeCommonState({
      input: 'hello',
      output: '/tmp/signed-message.saltpack',
      outputSenderFullname: '',
      outputSenderUsername: 'alice',
      outputSigned: true,
      outputStatus: 'success',
      outputType: 'file',
      outputValid: true,
    })
  )

  dispatch.resetOperation(Operations.Sign)
  dispatch.onSaltpackOpenFile(Operations.Sign, '/tmp/plain.txt')
  dispatch.runFileOperation(Operations.Sign, '/tmp/out')
  await flushPromises()

  expect(signFile).toHaveBeenCalledWith(
    {
      destinationDir: '/tmp/out',
      filename: '/tmp/plain.txt',
    },
    expect.any(String)
  )
  expect(getPublicState().sign).toEqual(
    makeCommonState({
      input: '/tmp/plain.txt',
      inputType: 'file',
      output: '/tmp/plain.txt.signed.saltpack',
      outputSenderFullname: '',
      outputSenderUsername: 'alice',
      outputSigned: true,
      outputStatus: 'success',
      outputType: 'file',
      outputValid: true,
    })
  )

  signFile.mockRejectedValueOnce(new RPCError('API network error', T.RPCGen.StatusCode.scgeneric))
  dispatch.onSaltpackOpenFile(Operations.Sign, '/tmp/offline.txt')
  dispatch.runFileOperation(Operations.Sign, '/tmp/out')
  await flushPromises()

  expect(getPublicState().sign).toEqual(
    makeCommonState({
      errorMessage: 'You are offline.',
      input: '/tmp/offline.txt',
      inputType: 'file',
    })
  )
})

test('verify supports text and file flows and exposes verification failures', async () => {
  const verifyString = jest.spyOn(T.RPCGen, 'saltpackSaltpackVerifyStringRpcPromise').mockResolvedValue({
    plaintext: 'verified text',
    sender: {fullname: 'Bob', username: 'bob'},
    verified: true,
  } as any)
  const verifyFile = jest.spyOn(T.RPCGen, 'saltpackSaltpackVerifyFileRpcPromise').mockResolvedValue({
    sender: {fullname: '', username: ''},
    verified: false,
    verifiedFilename: '/tmp/verified.txt',
  } as any)

  const {dispatch} = useCryptoState.getState()

  setOperationInput(Operations.Verify, 'text', 'signed message')
  dispatch.runTextOperation(Operations.Verify)
  await flushPromises()

  expect(verifyString).toHaveBeenCalledWith({signedMsg: 'signed message'}, expect.any(String))
  expect(getPublicState().verify).toEqual(
    makeCommonState({
      input: 'signed message',
      output: 'verified text',
      outputSenderFullname: 'Bob',
      outputSenderUsername: 'bob',
      outputSigned: true,
      outputStatus: 'success',
      outputType: 'text',
      outputValid: true,
    })
  )

  dispatch.resetOperation(Operations.Verify)
  dispatch.onSaltpackOpenFile(Operations.Verify, '/tmp/signed.saltpack')
  dispatch.runFileOperation(Operations.Verify, '/tmp/out')
  await flushPromises()

  expect(verifyFile).toHaveBeenCalledWith(
    {
      destinationDir: '/tmp/out',
      signedFilename: '/tmp/signed.saltpack',
    },
    expect.any(String)
  )
  expect(getPublicState().verify).toEqual(
    makeCommonState({
      input: '/tmp/signed.saltpack',
      inputType: 'file',
      output: '/tmp/verified.txt',
      outputSenderFullname: '',
      outputSenderUsername: '',
      outputSigned: false,
      outputStatus: 'success',
      outputType: 'file',
      outputValid: true,
    })
  )

  verifyString.mockRejectedValueOnce(
    new RPCError('verify failed', T.RPCGen.StatusCode.scsigcannotverify, [
      {key: 'ignored', value: T.RPCGen.StatusCode.scgeneric},
      {key: 'Code', value: T.RPCGen.StatusCode.scverificationkeynotfound},
    ])
  )
  setOperationInput(Operations.Verify, 'text', 'bad signed message')
  dispatch.runTextOperation(Operations.Verify)
  await flushPromises()

  expect(getPublicState().verify).toEqual(
    makeCommonState({
      errorMessage: "This message couldn't be verified, because the signing key wasn't recognized.",
      input: 'bad signed message',
    })
  )
})
