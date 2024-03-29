import * as C from '.'
import * as Platform from '@/constants/platform'
import * as Z from '@/util/zustand'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import * as T from './types'
import {RPCError} from '@/util/errors'

export const saltpackDocumentation = 'https://saltpack.org'
export const inputDesktopMaxHeight = {maxHeight: '30%'} as const
export const outputDesktopMaxHeight = {maxHeight: '70%'} as const
export const waitingKey = 'cryptoWaiting'

export const encryptTab = 'encryptTab'
export const decryptTab = 'decryptTab'
export const signTab = 'signTab'
export const verifyTab = 'verifyTab'

// Output route keys - Mobile only
export const encryptOutput = 'encryptOutput'
export const decryptOutput = 'decryptOutput'
export const signOutput = 'signOutput'
export const verifyOutput = 'verifyOutput'

// Update me once Saltpack works with files on mobile.
export const infoMessage = {
  decrypt: Platform.isMobile
    ? 'Decrypt messages encrypted with Saltpack.'
    : 'Decrypt any ciphertext or .encrypted.saltpack file.',
  encrypt: "Encrypt to anyone, even if they're not on Keybase yet.",
  sign: 'Add your cryptographic signature to a message or file.',
  verify: Platform.isMobile ? 'Verify a signed message.' : 'Verify any signed text or .signed.saltpack file.',
}

export const Tabs = [
  {
    description: infoMessage.encrypt,
    icon: 'iconfont-lock' as const,
    illustration: 'icon-encrypt-64' as const,
    tab: encryptTab,
    title: 'Encrypt',
  },
  {
    description: infoMessage.decrypt,
    icon: 'iconfont-unlock' as const,
    illustration: 'icon-decrypt-64' as const,
    tab: decryptTab,
    title: 'Decrypt',
  },
  {
    description: infoMessage.sign,
    icon: 'iconfont-check' as const,
    illustration: 'icon-sign-64' as const,
    tab: signTab,
    title: 'Sign',
  },
  {
    description: infoMessage.verify,
    icon: 'iconfont-verify' as const,
    illustration: 'icon-verify-64' as const,
    tab: verifyTab,
    title: 'Verify',
  },
]

type CommonStore = {
  bytesComplete: number
  bytesTotal: number
  errorMessage: HiddenString
  inProgress: boolean
  input: HiddenString
  inputType: 'text' | 'file'
  output: HiddenString
  outputFileDestination: HiddenString
  outputSenderFullname?: HiddenString
  outputSenderUsername?: HiddenString
  outputSigned?: boolean
  outputStatus?: 'success' | 'pending' | 'error'
  outputType?: 'text' | 'file'
  warningMessage: HiddenString
  // to ensure what the user types matches the input
  outputValid: boolean
}

type EncryptOptions = {
  includeSelf: boolean
  sign: boolean
}

type Store = T.Immutable<{
  decrypt: CommonStore
  encrypt: CommonStore & {
    meta: {
      hasRecipients: boolean
      hasSBS: boolean
      hideIncludeSelf: boolean
    }
    options: EncryptOptions
    recipients: Array<string> // Only for encrypt operation
  }
  sign: CommonStore
  verify: CommonStore
}>

export const Operations = {
  Decrypt: 'decrypt',
  Encrypt: 'encrypt',
  Sign: 'sign',
  Verify: 'verify',
} as const

export const isPathSaltpackEncrypted = (path: string) => path.endsWith('.encrypted.saltpack')
export const isPathSaltpackSigned = (path: string) => path.endsWith('.signed.saltpack')
export const isPathSaltpack = (path: string) => isPathSaltpackEncrypted(path) || isPathSaltpackSigned(path)

const getWarningMessageForSBS = (sbsAssertion: string) =>
  `Note: Encrypted for "${sbsAssertion}" who is not yet a Keybase user. One of your devices will need to be online after they join Keybase in order for them to decrypt the message.`

const getStatusCodeMessage = (
  error: RPCError,
  operation: T.Crypto.Operations,
  type: T.Crypto.InputTypes
): string => {
  const inputType =
    type === 'text' ? (operation === Operations.Verify ? 'signed message' : 'ciphertext') : 'file'
  const action = type === 'text' ? (operation === Operations.Verify ? 'enter a' : 'enter') : 'drop a'
  const addInput =
    type === 'text' ? (operation === Operations.Verify ? 'signed message' : 'ciphertext') : 'encrypted file'

  const offlineMessage = `You are offline.`
  const genericMessage = `Failed to ${operation} ${type}.`

  let wrongTypeHelpText = ``
  if (operation === Operations.Verify) {
    wrongTypeHelpText = ` Did you mean to decrypt it?` // just a guess. could get specific expected type from Cause with more effort.
  } else if (operation === Operations.Decrypt) {
    wrongTypeHelpText = ` Did you mean to verify it?` // just a guess.
  }

  const fields = error.fields as Array<{key: string; value: T.RPCGen.StatusCode}> | undefined
  const field = fields?.[1]
  const causeStatusCode = field?.key === 'Code' ? field.value : T.RPCGen.StatusCode.scgeneric
  const causeStatusCodeToMessage = new Map([
    [T.RPCGen.StatusCode.scapinetworkerror, offlineMessage],
    [
      T.RPCGen.StatusCode.scdecryptionkeynotfound,
      `This message was encrypted for someone else or for a key you don't have.`,
    ],
    [
      T.RPCGen.StatusCode.scverificationkeynotfound,
      `This message couldn't be verified, because the signing key wasn't recognized.`,
    ],
    [T.RPCGen.StatusCode.scwrongcryptomsgtype, `This Saltpack format is unexpected.` + wrongTypeHelpText],
  ])

  const statusCodeToMessage = new Map([
    [T.RPCGen.StatusCode.scapinetworkerror, offlineMessage],
    [
      T.RPCGen.StatusCode.scgeneric,
      `${error.message.includes('API network error') ? offlineMessage : genericMessage}`,
    ],
    [
      T.RPCGen.StatusCode.scstreamunknown,
      `This ${inputType} is not in a valid Saltpack format. Please ${action} Saltpack ${addInput}.`,
    ],
    [T.RPCGen.StatusCode.scsigcannotverify, causeStatusCodeToMessage.get(causeStatusCode) || genericMessage],
    [T.RPCGen.StatusCode.scdecryptionerror, causeStatusCodeToMessage.get(causeStatusCode) || genericMessage],
  ])

  return statusCodeToMessage.get(error.code) ?? genericMessage
}

// State
const defaultCommonStore = {
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: new HiddenString(''),
  inProgress: false,
  input: new HiddenString(''),
  inputType: 'text' as T.Crypto.InputTypes,
  output: new HiddenString(''),
  outputFileDestination: new HiddenString(''),
  outputSenderFullname: undefined,
  outputSenderUsername: undefined,
  outputSigned: false,
  outputStatus: undefined,
  outputType: undefined,
  outputValid: false,
  warningMessage: new HiddenString(''),
}

const initialStore: Store = {
  decrypt: {...defaultCommonStore},
  encrypt: {
    ...defaultCommonStore,
    meta: {
      hasRecipients: false,
      hasSBS: false,
      hideIncludeSelf: false,
    },
    options: {
      includeSelf: true,
      sign: true,
    },
    recipients: [],
  },
  sign: {...defaultCommonStore},
  verify: {...defaultCommonStore},
}

type State = Store & {
  dispatch: {
    clearInput: (op: T.Crypto.Operations) => void
    clearRecipients: () => void
    downloadEncryptedText: () => void
    downloadSignedText: () => void
    resetState: 'default'
    resetOperation: (op: T.Crypto.Operations) => void
    runFileOperation: (op: T.Crypto.Operations, destinationDir: string) => void
    runTextOperation: (op: T.Crypto.Operations) => void
    onSaltpackDone: (op: T.Crypto.Operations) => void
    onSaltpackStart: (op: T.Crypto.Operations) => void
    onSaltpackProgress: (op: T.Crypto.Operations, bytesComplete: number, bytesTotal: number) => void
    onSaltpackOpenFile: (op: T.Crypto.Operations, path: string) => void
    onTeamBuildingFinished: (users: ReadonlySet<T.TB.User>) => void
    setEncryptOptions: (options: EncryptOptions, hideIncludeSelf?: boolean) => void
    setInput: (op: T.Crypto.Operations, type: T.Crypto.InputTypes, value: string) => void
    setRecipients: (recipients: ReadonlyArray<string>, hasSBS: boolean) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const resetWarnings = (o: CommonStore) => {
    o.errorMessage = new HiddenString('')
    o.warningMessage = new HiddenString('')
  }

  const resetOutput = (o: CommonStore) => {
    resetWarnings(o)
    o.bytesComplete = 0
    o.bytesTotal = 0
    o.output = new HiddenString('')
    o.outputStatus = undefined
    o.outputType = undefined
    o.outputSenderUsername = undefined
    o.outputSenderFullname = undefined
    o.outputValid = false
  }

  const onError = (cs: CommonStore, errorMessage: string) => {
    resetOutput(cs)
    cs.errorMessage = new HiddenString(errorMessage)
  }

  const onSuccess = (
    cs: CommonStore,
    outputValid: boolean,
    warningMessage: string,
    output: string,
    inputType: 'file' | 'text',
    signed: boolean,
    senderUsername: string,
    senderFullname: string
  ) => {
    cs.outputValid = outputValid
    resetWarnings(cs)
    cs.warningMessage = new HiddenString(warningMessage)
    cs.output = new HiddenString(output)
    cs.outputStatus = 'success'
    cs.outputType = inputType
    cs.outputSigned = signed
    cs.outputSenderUsername = new HiddenString(signed ? senderUsername : '')
    cs.outputSenderFullname = new HiddenString(signed ? senderFullname : '')
  }

  const encrypt = (destinationDir: string = '') => {
    const f = async () => {
      const start = get().encrypt
      const username = C.useCurrentUserState.getState().username
      const signed = start.options.sign
      const inputType = start.inputType
      const input = start.input.stringValue()
      const opts = {
        includeSelf: start.options.includeSelf,
        recipients: start.recipients.length ? start.recipients : [username],
        signed,
      }
      try {
        const callText = async () => {
          const {
            usedUnresolvedSBS,
            unresolvedSBSAssertion,
            ciphertext: output,
          } = await T.RPCGen.saltpackSaltpackEncryptStringRpcPromise({opts, plaintext: input}, waitingKey)
          return {output, unresolvedSBSAssertion, usedUnresolvedSBS}
        }
        const callFile = async () => {
          const {
            usedUnresolvedSBS,
            unresolvedSBSAssertion,
            filename: output,
          } = await T.RPCGen.saltpackSaltpackEncryptFileRpcPromise(
            {destinationDir, filename: input, opts},
            waitingKey
          )
          return {output, unresolvedSBSAssertion, usedUnresolvedSBS}
        }
        const {output, unresolvedSBSAssertion, usedUnresolvedSBS} = await (inputType === 'text'
          ? callText()
          : callFile())

        set(s => {
          onSuccess(
            s.encrypt,
            s.encrypt.input.stringValue() === input,
            usedUnresolvedSBS ? getWarningMessageForSBS(unresolvedSBSAssertion) : '',
            output,
            inputType,
            signed,
            username,
            ''
          )
        })
      } catch (_error) {
        if (!(_error instanceof RPCError)) {
          return
        }
        const error = _error
        logger.error(error)
        set(s => {
          onError(s.encrypt, getStatusCodeMessage(error, 'encrypt', inputType))
        })
      }
    }
    C.ignorePromise(f())
  }

  const decrypt = (destinationDir: string = '') => {
    const f = async () => {
      const start = get().decrypt
      const inputType = start.inputType
      const input = start.input.stringValue()
      try {
        const callText = async () => {
          const res = await T.RPCGen.saltpackSaltpackDecryptStringRpcPromise({ciphertext: input}, waitingKey)
          const {plaintext: output, info, signed} = res
          const {sender} = info
          const {username, fullname} = sender
          return {fullname, output, signed, username}
        }

        const callFile = async () => {
          const result = await T.RPCGen.saltpackSaltpackDecryptFileRpcPromise(
            {destinationDir, encryptedFilename: input},
            waitingKey
          )
          const {decryptedFilename: output, info, signed} = result
          const {sender} = info
          const {username, fullname} = sender
          return {fullname, output, signed, username}
        }

        const {fullname, output, signed, username} = await (inputType === 'text' ? callText() : callFile())
        set(s => {
          onSuccess(
            s.decrypt,
            s.decrypt.input.stringValue() === input,
            '',
            output,
            inputType,
            signed,
            username,
            fullname
          )
        })
      } catch (_error) {
        if (!(_error instanceof RPCError)) {
          return
        }
        const error = _error
        logger.error(error)
        set(s => {
          onError(s.decrypt, getStatusCodeMessage(error, 'decrypt', inputType))
        })
      }
    }

    C.ignorePromise(f())
  }

  const sign = (destinationDir: string = '') => {
    const f = async () => {
      const start = get().sign
      const inputType = start.inputType
      const input = start.input.stringValue()
      try {
        const callText = async () =>
          await T.RPCGen.saltpackSaltpackSignStringRpcPromise({plaintext: input}, waitingKey)

        const callFile = async () =>
          await T.RPCGen.saltpackSaltpackSignFileRpcPromise({destinationDir, filename: input}, waitingKey)

        const output = await (inputType === 'text' ? callText() : callFile())

        const username = C.useCurrentUserState.getState().username
        set(s => {
          onSuccess(s.sign, s.sign.input.stringValue() === input, '', output, inputType, true, username, '')
        })
      } catch (_error) {
        if (!(_error instanceof RPCError)) {
          return
        }
        const error = _error
        logger.error(error)
        set(s => {
          onError(s.sign, getStatusCodeMessage(error, 'sign', inputType))
        })
      }
    }

    C.ignorePromise(f())
  }

  const verify = (destinationDir: string = '') => {
    const f = async () => {
      const start = get().verify
      const inputType = start.inputType
      const input = start.input.stringValue()
      try {
        const callText = async () => {
          const res = await T.RPCGen.saltpackSaltpackVerifyStringRpcPromise({signedMsg: input}, waitingKey)
          const {plaintext: output, sender, verified: signed} = res
          const {username, fullname} = sender
          return {fullname, output, signed, username}
        }
        const callFile = async () => {
          const res = await T.RPCGen.saltpackSaltpackVerifyFileRpcPromise(
            {destinationDir, signedFilename: input},
            waitingKey
          )
          const {verifiedFilename: output, sender, verified: signed} = res
          const {username, fullname} = sender
          return {fullname, output, signed, username}
        }
        const {fullname, output, signed, username} = await (inputType === 'text' ? callText() : callFile())
        set(s => {
          onSuccess(
            s.verify,
            s.verify.input.stringValue() === input,
            '',
            output,
            inputType,
            signed,
            username,
            fullname
          )
        })
      } catch (_error) {
        if (!(_error instanceof RPCError)) {
          return
        }
        const error = _error
        logger.error(error)
        set(s => {
          onError(s.verify, getStatusCodeMessage(error, 'verify', inputType))
        })
      }
    }

    C.ignorePromise(f())
  }

  const download = (op: T.Crypto.Operations) => {
    const f = async () => {
      const callEncrypt = async () =>
        await T.RPCGen.saltpackSaltpackSaveCiphertextToFileRpcPromise({
          ciphertext: get().encrypt.output.stringValue(),
        })
      const callSign = async () =>
        await T.RPCGen.saltpackSaltpackSaveSignedMsgToFileRpcPromise({
          signedMsg: get().sign.output.stringValue(),
        })
      const output = await (op === 'encrypt' ? callEncrypt() : callSign())
      set(s => {
        const o = s[op]
        resetWarnings(o)
        o.output = new HiddenString(output)
        o.outputStatus = 'success'
        o.outputType = 'file'
      })
    }
    C.ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    clearInput: op => {
      set(s => {
        const o = s[op]
        resetOutput(o)
        o.inputType = 'text'
        o.input = new HiddenString('')
        o.outputValid = true
      })
    },
    clearRecipients: () => {
      set(s => {
        const e = s.encrypt
        resetOutput(e)
        e.recipients = T.castDraft(initialStore.encrypt.recipients)
        // Reset options since they depend on the recipients
        e.options = initialStore.encrypt.options
        e.meta = initialStore.encrypt.meta
      })
    },
    downloadEncryptedText: () => {
      download('encrypt')
    },
    downloadSignedText: () => {
      download('sign')
    },
    onSaltpackDone: op => {
      set(s => {
        const o = s[op]
        // For any file operation that completes, invalidate the output since multiple decrypt/verify operations will produce filenames with unique
        // counters on the end (as to not overwrite any existing files in the user's FS).
        // E.g. `${plaintextFilename} (n).ext`
        o.outputValid = false
        o.bytesComplete = 0
        o.bytesTotal = 0
        o.inProgress = false
        o.outputStatus = 'pending'
      })
    },
    onSaltpackOpenFile: (op, path) => {
      set(s => {
        const o = s[op]
        // Bail on setting operation input if another file RPC is in progress
        if (o.inProgress) return
        if (!path) return

        resetOutput(o)
        o.input = new HiddenString(path)
        o.inputType = 'file'
        resetWarnings(o)
      })
    },
    onSaltpackProgress: (op, bytesComplete, bytesTotal) => {
      set(s => {
        const o = s[op]
        const done = bytesComplete === bytesTotal
        o.bytesComplete = done ? 0 : bytesComplete
        o.bytesTotal = done ? 0 : bytesTotal
        o.inProgress = !done
        if (!done) {
          o.outputStatus = 'pending'
        }
      })
    },
    onSaltpackStart: op => {
      set(s => {
        s[op].inProgress = true
      })
    },
    onTeamBuildingFinished: _users => {
      const users = [..._users]
      let hasSBS = false as boolean
      const usernames = users.map(user => {
        // If we're encrypting to service account that is not proven on keybase set
        // (SBS) then we *must* encrypt to ourselves
        if (user.serviceId === 'email') {
          hasSBS = true
          return `[${user.username}]@email`
        }
        if (user.serviceId !== 'keybase') {
          hasSBS = true
          return `${user.username}@${user.serviceId}`
        }
        return user.username
      })

      // User set themselves as a recipient, so don't show 'includeSelf' option
      // However we don't want to set hideIncludeSelf if we are also encrypting to an SBS user (since we must force includeSelf)
      const currentUser = C.useCurrentUserState.getState().username
      const {options} = get().encrypt
      if (usernames.includes(currentUser) && !hasSBS) {
        get().dispatch.setEncryptOptions(options, true)
      }
      get().dispatch.setRecipients(usernames, hasSBS)
    },
    resetOperation: op => {
      set(s => {
        switch (op) {
          case Operations.Encrypt:
            s[op] = T.castDraft(initialStore[op])
            break
          case Operations.Decrypt:
          case Operations.Sign:
          case Operations.Verify:
            s[op] = T.castDraft(initialStore[op])
            break
        }
      })
    },
    resetState: 'default',
    runFileOperation: (op, destinationDir) => {
      set(s => {
        const o = s[op]
        o.outputValid = false
        resetWarnings(o)
      })
      switch (op) {
        case 'encrypt':
          encrypt(destinationDir)
          break
        case 'decrypt':
          decrypt(destinationDir)
          break
        case 'verify':
          verify(destinationDir)
          break
        case 'sign':
          sign(destinationDir)
          break
      }
    },
    runTextOperation: op => {
      let route: 'decryptOutput' | 'encryptOutput' | 'signOutput' | 'verifyOutput'
      switch (op) {
        case 'decrypt':
          decrypt()
          route = 'decryptOutput'
          break
        case 'encrypt':
          route = 'encryptOutput'
          encrypt()
          break
        case 'sign':
          route = 'signOutput'
          sign()
          break
        case 'verify':
          route = 'verifyOutput'
          verify()
          break
      }
      if (Platform.isMobile) {
        C.useRouterState.getState().dispatch.navigateAppend(route)
      }
    },
    setEncryptOptions: (newOptions, hideIncludeSelf) => {
      set(s => {
        const e = s.encrypt
        e.options = {
          ...e.options,
          ...newOptions,
        }
        // Reset output when file input changes
        // Prompt for destination dir
        if (e.inputType === 'file') {
          resetOutput(e)
        }
        // Output no longer valid since options have changed
        e.outputValid = false
        // User set themselves as a recipient so don't show the 'includeSelf' option for encrypt (since they're encrypting to themselves)
        if (hideIncludeSelf) {
          e.meta.hideIncludeSelf = hideIncludeSelf
          e.options.includeSelf = false
        }
      })

      if (get().encrypt.inputType === 'text') {
        encrypt('')
      }
    },
    setInput: (op: T.Crypto.Operations, type: T.Crypto.InputTypes, value: string) => {
      if (!value) {
        get().dispatch.clearInput(op)
        return
      }
      set(s => {
        const o = s[op]
        const oldInput = o.input
        // Reset input to 'text' when no value given (cleared input or removed file upload)
        const inputType = value ? type : 'text'
        const outputValid = oldInput.stringValue() === value

        o.inputType = inputType
        o.input = new HiddenString(value)
        o.outputValid = outputValid
        resetWarnings(o)

        // Reset output when file input changes
        // Prompt for destination dir
        if (inputType === 'file') {
          resetOutput(o)
        }
      })
      // mobile doesn't run anything automatically
      if (type === 'text' && !Platform.isMobile) {
        get().dispatch.runTextOperation(op)
      }
    },
    setRecipients: (recipients, hasSBS) => {
      set(s => {
        const o = s.encrypt
        // Reset output when file input changes
        // Prompt for destination dir
        if (o.inputType === 'file') {
          resetOutput(o)
        }
        // Output no longer valid since recipients have changed
        o.outputValid = false
        if (!o.recipients.length && recipients.length) {
          o.meta.hasRecipients = true
          o.meta.hasSBS = hasSBS
        }
        // Force signing when user is SBS
        if (hasSBS) {
          o.options.sign = true
        }
        o.recipients = T.castDraft(recipients)
      })
      // mobile doesn't run anything automatically
      if (get().encrypt.inputType === 'text' && !Platform.isMobile) {
        get().dispatch.runTextOperation('encrypt')
      }
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
