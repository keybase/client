import * as Platform from '../constants/platform'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Z from '../util/zustand'
import * as UserConstants from './current-user'
import {RPCError} from '../util/errors'
import logger from '../logger'
// import * as TeamBuildingConstants from './team-building'
import HiddenString from '../util/hidden-string'
import type * as Types from './types/crypto'

export const saltpackDocumentation = 'https://saltpack.org'

export const inputDesktopMaxHeight = {maxHeight: '30%'}
export const outputDesktopMaxHeight = {maxHeight: '70%'}

export const waitingKey = 'cryptoWaiting'

// Tab keys
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
} as const

export const Tabs = [
  {
    description: infoMessage.encrypt,
    icon: 'iconfont-lock',
    illustration: 'icon-encrypt-64',
    tab: encryptTab,
    title: 'Encrypt',
  },
  {
    description: infoMessage.decrypt,
    icon: 'iconfont-unlock',
    illustration: 'icon-decrypt-64',
    tab: decryptTab,
    title: 'Decrypt',
  },
  {
    description: infoMessage.sign,
    icon: 'iconfont-check',
    illustration: 'icon-sign-64',
    tab: signTab,
    title: 'Sign',
  },
  {
    description: infoMessage.verify,
    icon: 'iconfont-verify',
    illustration: 'icon-verify-64',
    tab: verifyTab,
    title: 'Verify',
  },
] as const

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
  operation: Types.Operations,
  type: Types.InputTypes
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

  const causeStatusCode =
    error.fields && error.fields[1].key === 'Code' ? error.fields[1].value : RPCTypes.StatusCode.scgeneric
  const causeStatusCodeToMessage: any = {
    [RPCTypes.StatusCode.scapinetworkerror]: offlineMessage,
    [RPCTypes.StatusCode
      .scdecryptionkeynotfound]: `This message was encrypted for someone else or for a key you don't have.`,
    [RPCTypes.StatusCode
      .scverificationkeynotfound]: `This message couldn't be verified, because the signing key wasn't recognized.`,
    [RPCTypes.StatusCode.scwrongcryptomsgtype]: `This Saltpack format is unexpected.` + wrongTypeHelpText,
  } as const

  const statusCodeToMessage: any = {
    [RPCTypes.StatusCode.scapinetworkerror]: offlineMessage,
    [RPCTypes.StatusCode.scgeneric]: `${
      error.message.includes('API network error') ? offlineMessage : genericMessage
    }`,
    [RPCTypes.StatusCode
      .scstreamunknown]: `This ${inputType} is not in a valid Saltpack format. Please ${action} Saltpack ${addInput}.`,
    [RPCTypes.StatusCode.scsigcannotverify]: causeStatusCodeToMessage[causeStatusCode] || genericMessage,
    [RPCTypes.StatusCode.scdecryptionerror]: causeStatusCodeToMessage[causeStatusCode] || genericMessage,
  } as const

  return statusCodeToMessage[error.code] || genericMessage
}

// State
const defaultCommonState = {
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: new HiddenString(''),
  inProgress: false,
  input: new HiddenString(''),
  inputType: 'text' as Types.InputTypes,
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

const initialState: Types.State = {
  decrypt: {
    ...defaultCommonState,
  },
  encrypt: {
    ...defaultCommonState,
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
  sign: {
    ...defaultCommonState,
  },
  // teamBuilding: TeamBuildingConstants.makeSubState(),
  verify: {
    ...defaultCommonState,
  },
}

type ZState = Types.State & {
  dispatch: {
    clearInput: (op: Types.Operations) => void
    clearRecipients: () => void
    downloadEncryptedText: () => void
    downloadSignedText: () => void
    reset: () => void
    resetOperation: (op: Types.Operations) => void
    runFileOperation: (op: Types.Operations, destinationDir: string) => void
    runTextOperation: (op: Types.Operations) => void
    onSaltpackDone: (op: Types.Operations) => void
    onSaltpackStart: (op: Types.Operations) => void
    onSaltpackProgress: (op: Types.Operations, bytesComplete: number, bytesTotal: number) => void
    onSaltpackOpenFile: (op: Types.Operations, path: string) => void
    setEncryptOptions: (options: Types.EncryptOptions, hideIncludeSelf?: boolean) => void
    setInput: (op: Types.Operations, type: Types.InputTypes, value: string) => void
    setRecipients: (recipients: Array<string>, hasSBS: boolean) => void
  }
}

export const useState = Z.createZustand(
  Z.immerZustand<ZState>((set, get) => {
    // const reduxDispatch = Container.getReduxDispatch()

    const resetOutput = (o: Types.CommonState) => {
      o.output = new HiddenString('')
      o.outputStatus = undefined
      o.outputType = undefined
      o.outputSenderUsername = undefined
      o.outputSenderFullname = undefined
      o.outputValid = false
      o.errorMessage = new HiddenString('')
      o.warningMessage = new HiddenString('')
    }

    const onError = (cs: Types.CommonState, errorMessage: string) => {
      cs.outputValid = false
      cs.errorMessage = new HiddenString(errorMessage)
      cs.warningMessage = new HiddenString('')
      cs.output = new HiddenString('')
      cs.outputSenderUsername = new HiddenString('')
    }

    const onSuccess = (
      cs: Types.CommonState,
      outputValid: boolean,
      warningMessage: string,
      output: string,
      inputType: 'file' | 'text',
      signed: boolean,
      senderUsername: string,
      senderFullname: string
    ) => {
      cs.outputValid = outputValid
      cs.errorMessage = new HiddenString('')
      cs.warningMessage = new HiddenString(warningMessage)
      cs.output = new HiddenString(output)
      cs.outputStatus = 'success'
      cs.outputType = inputType
      cs.outputSigned = signed
      cs.outputSenderUsername = new HiddenString(signed ? senderUsername : '')
      cs.outputSenderFullname = new HiddenString(signed ? senderFullname : '')
    }

    const encryptText = () => {
      const f = async () => {
        const start = get().encrypt

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        const username = UserConstants.useCurrentUserState.getState().username
        let rs = start.recipients
        if (!rs.length) {
          rs = [username]
        }
        const signed = start.options.sign

        const inputType = start.inputType
        const plaintext = start.input.stringValue()
        try {
          const res = await RPCTypes.saltpackSaltpackEncryptStringRpcPromise(
            {
              opts: {includeSelf: start.options.includeSelf, recipients: rs, signed},
              plaintext,
            },
            waitingKey
          )
          set(s => {
            onSuccess(
              s.encrypt,
              s.encrypt.input.stringValue() === plaintext,
              res.usedUnresolvedSBS ? getWarningMessageForSBS(res.unresolvedSBSAssertion) : '',
              res.ciphertext,
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
            onError(s.encrypt, getStatusCodeMessage(error, 'encrypt', 'text'))
          })
        }
      }

      Z.ignorePromise(f())
    }

    const encryptFile = (destinationDir: string) => {
      const f = async () => {
        const start = get().encrypt

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        const username = UserConstants.useCurrentUserState.getState().username
        let rs = start.recipients
        if (!rs.length) {
          rs = [username]
        }
        const signed = start.options.sign

        const filename = start.input.stringValue()
        try {
          const res = await RPCTypes.saltpackSaltpackEncryptFileRpcPromise(
            {
              destinationDir,
              filename,
              opts: {includeSelf: start.options.includeSelf, recipients: rs, signed},
            },
            waitingKey
          )
          set(s => {
            onSuccess(
              s.encrypt,
              s.encrypt.input.stringValue() === filename,
              res.usedUnresolvedSBS ? getWarningMessageForSBS(res.unresolvedSBSAssertion) : '',
              res.filename,
              'file',
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
            onError(s.encrypt, getStatusCodeMessage(error, 'encrypt', 'file'))
          })
        }
      }
      Z.ignorePromise(f())
    }

    const decryptText = () => {
      const f = async () => {
        const start = get().decrypt

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        try {
          const ciphertext = start.input.stringValue()
          const res = await RPCTypes.saltpackSaltpackDecryptStringRpcPromise({ciphertext}, waitingKey)
          const {plaintext, info, signed} = res
          const {sender} = info
          const {username, fullname} = sender

          set(s => {
            onSuccess(
              s.decrypt,
              s.decrypt.input.stringValue() === ciphertext,
              '',
              plaintext,
              'text',
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
            onError(s.decrypt, getStatusCodeMessage(error, 'decrypt', 'text'))
          })
        }
      }

      Z.ignorePromise(f())
    }

    const decryptFile = (destinationDir: string) => {
      const f = async () => {
        const start = get().decrypt

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        const filename = start.input.stringValue()
        try {
          const result = await RPCTypes.saltpackSaltpackDecryptFileRpcPromise(
            {destinationDir, encryptedFilename: filename},
            waitingKey
          )
          const {decryptedFilename, info, signed} = result
          const {sender} = info
          const {username, fullname} = sender
          set(s => {
            onSuccess(
              s.decrypt,
              s.decrypt.input.stringValue() === filename,
              '',
              decryptedFilename,
              'file',
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
            onError(s.decrypt, getStatusCodeMessage(error, 'decrypt', 'file'))
          })
        }
      }
      Z.ignorePromise(f())
    }

    const signText = () => {
      const f = async () => {
        const start = get().sign

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        try {
          const plaintext = start.input.stringValue()
          const ciphertext = await RPCTypes.saltpackSaltpackSignStringRpcPromise({plaintext}, waitingKey)
          const username = UserConstants.useCurrentUserState.getState().username
          set(s => {
            onSuccess(
              s.sign,
              s.sign.input.stringValue() === plaintext,
              '',
              ciphertext,
              'text',
              true,
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
            onError(s.sign, getStatusCodeMessage(error, 'sign', 'text'))
          })
        }
      }

      Z.ignorePromise(f())
    }

    const signFile = (destinationDir: string) => {
      const f = async () => {
        const start = get().sign

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        const username = UserConstants.useCurrentUserState.getState().username
        const filename = start.input.stringValue()
        try {
          const signedFilename = await RPCTypes.saltpackSaltpackSignFileRpcPromise(
            {destinationDir, filename},
            waitingKey
          )
          set(s => {
            onSuccess(
              s.sign,
              s.sign.input.stringValue() === filename,
              '',
              signedFilename,
              'file',
              true,
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
            onError(s.sign, getStatusCodeMessage(error, 'sign', 'file'))
          })
        }
      }
      Z.ignorePromise(f())
    }

    const verifyText = () => {
      const f = async () => {
        const start = get().verify

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        try {
          const signedMsg = start.input.stringValue()
          const res = await RPCTypes.saltpackSaltpackVerifyStringRpcPromise({signedMsg}, waitingKey)
          const {plaintext, sender, verified} = res
          const {username, fullname} = sender
          set(s => {
            onSuccess(
              s.verify,
              s.verify.input.stringValue() === signedMsg,
              '',
              plaintext,
              'text',
              verified,
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
            onError(s.verify, getStatusCodeMessage(error, 'verify', 'text'))
          })
        }
      }

      Z.ignorePromise(f())
    }

    const verifyFile = (destinationDir: string) => {
      const f = async () => {
        const start = get().verify

        // mobile doesn't run anything automatically
        if (Platform.isMobile) return
        if (start.inProgress) return

        const signedFilename = start.input.stringValue()
        try {
          const res = await RPCTypes.saltpackSaltpackVerifyFileRpcPromise(
            {destinationDir, signedFilename},
            waitingKey
          )
          const {verifiedFilename, sender, verified} = res
          const {username, fullname} = sender
          set(s => {
            onSuccess(
              s.verify,
              s.verify.input.stringValue() === signedFilename,
              '',
              verifiedFilename,
              'file',
              verified,
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
            onError(s.verify, getStatusCodeMessage(error, 'verify', 'file'))
          })
        }
      }
      Z.ignorePromise(f())
    }

    const dispatch = {
      clearInput: (op: Types.Operations) => {
        set(s => {
          const o = s[op]
          o.bytesComplete = 0
          o.bytesTotal = 0
          o.inputType = 'text'
          o.input = new HiddenString('')
          o.output = new HiddenString('')
          o.outputStatus = undefined
          o.outputType = undefined
          o.outputSenderUsername = undefined
          o.outputSenderFullname = undefined
          o.errorMessage = new HiddenString('')
          o.warningMessage = new HiddenString('')
          o.outputValid = true
        })
      },
      clearRecipients: () => {
        set(s => {
          const e = s.encrypt
          e.bytesComplete = 0
          e.bytesTotal = 0
          e.recipients = initialState.encrypt.recipients
          // Reset options since they depend on the recipients
          e.options = initialState.encrypt.options
          e.meta = initialState.encrypt.meta
          e.output = new HiddenString('')
          e.outputStatus = undefined
          e.outputType = undefined
          e.outputSenderUsername = undefined
          e.outputSenderFullname = undefined
          e.outputValid = false
          e.errorMessage = new HiddenString('')
          e.warningMessage = new HiddenString('')
        })
      },
      downloadEncryptedText: () => {
        const f = async () => {
          const result = await RPCTypes.saltpackSaltpackSaveCiphertextToFileRpcPromise({
            ciphertext: get().encrypt.output.stringValue(),
          })
          set(s => {
            const o = s.encrypt
            o.errorMessage = new HiddenString('')
            o.warningMessage = new HiddenString('')
            o.output = new HiddenString(result)
            o.outputStatus = 'success'
            o.outputType = 'file'
          })
        }
        Z.ignorePromise(f())
      },
      downloadSignedText: () => {
        const f = async () => {
          const {output} = get().sign
          const result = await RPCTypes.saltpackSaltpackSaveSignedMsgToFileRpcPromise({
            signedMsg: output.stringValue(),
          })
          set(s => {
            const o = s.sign
            o.errorMessage = new HiddenString('')
            o.warningMessage = new HiddenString('')
            o.output = new HiddenString(result)
            o.outputStatus = 'success'
            o.outputType = 'file'
          })
        }
        Z.ignorePromise(f())
      },
      onSaltpackDone: (op: Types.Operations) => {
        set(s => {
          const o = s[op]
          // For any file operation that completes, invalidate the output since multiple decrypt/verify operations will produce filenames with unqiue
          // counters on the end (as to not overwrite any existing files in the user's FS).
          // E.g. `${plaintextFilename} (n).ext`
          o.outputValid = false
          o.bytesComplete = 0
          o.bytesTotal = 0
          o.inProgress = false
          o.outputStatus = 'pending'
        })
      },
      onSaltpackOpenFile: (op: Types.Operations, path: string) => {
        set(s => {
          const o = s[op]
          // Bail on setting operation input if another file RPC is in progress
          if (o.inProgress) return
          if (!path) return

          resetOutput(o)
          o.input = new HiddenString(path)
          o.inputType = 'file'
          o.errorMessage = new HiddenString('')
          o.warningMessage = new HiddenString('')
        })
      },
      onSaltpackProgress: (op: Types.Operations, bytesComplete: number, bytesTotal: number) => {
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
      onSaltpackStart: (op: Types.Operations) => {
        set(s => {
          s[op].inProgress = true
        })
      },
      reset: () => {
        set(() => initialState)
      },
      resetOperation: (op: Types.Operations) => {
        set(s => {
          switch (op) {
            case Operations.Encrypt:
              s[op] = initialState[op]
              break
            case Operations.Decrypt:
            case Operations.Sign:
            case Operations.Verify:
              s[op] = initialState[op]
              break
          }
        })
      },
      runFileOperation: (op: Types.Operations, destinationDir: string) => {
        set(s => {
          const o = s[op]
          o.outputValid = false
          o.errorMessage = new HiddenString('')
          o.warningMessage = new HiddenString('')
        })
        switch (op) {
          case 'encrypt':
            encryptFile(destinationDir)
            break
          case 'decrypt':
            decryptFile(destinationDir)
            break
          case 'verify':
            verifyFile(destinationDir)
            break
          case 'sign':
            signFile(destinationDir)
            break
        }
      },
      runTextOperation: (_op: Types.Operations) => {
        // TODO on mobile
      },
      setEncryptOptions: (newOptions: Types.EncryptOptions, hideIncludeSelf?: boolean) => {
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
      },
      setInput: (op: Types.Operations, type: Types.InputTypes, value: string) => {
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
          o.errorMessage = new HiddenString('')
          o.warningMessage = new HiddenString('')

          // Reset output when file input changes
          // Prompt for destination dir
          if (inputType === 'file') {
            resetOutput(o)
          }
        })
        if (type === 'text') {
          switch (op) {
            case 'decrypt':
              decryptText()
              break
            case 'encrypt':
              encryptText()
              break
            case 'sign':
              signText()
              break
            case 'verify':
              verifyText()
              break
          }
        }
      },
      setRecipients: (recipients: Array<string>, hasSBS: boolean) => {
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
          o.recipients = recipients
        })
      },
    }
    return {
      ...initialState,
      dispatch,
    }
  })
)

// type EncryptState = {
//   bytesComplete: number
//   bytesTotal: number
//   errorMessage: string
//   file: string
//   hasSBS: boolean
//   hideIncludeSelf: boolean
//   inProgress: boolean
//   includeSelf: boolean
//   output: string
//   outputSenderFullname: string
//   outputSenderUsername: string
//   outputSigned: boolean
//   outputStatus: 'success' | 'pending' | 'error'
//   outputValid: boolean
//   recipients: Array<string>
//   sign: boolean
//   text: string
//   warningMessage: string
// }
// const initialEncryptState: EncryptState = {
//   bytesComplete: 0,
//   bytesTotal: 0,
//   errorMessage: '',
//   file: '',
//   hasSBS: false,
//   hideIncludeSelf: true,
//   inProgress: false,
//   includeSelf: false,
//   output: '',
//   outputSenderFullname: '',
//   outputSenderUsername: '',
//   outputSigned: false,
//   outputStatus: 'success',
//   outputValid: false,
//   recipients: [],
//   sign: false,
//   text: '',
//   warningMessage: '',
// }
// type ZEncryptState = EncryptState & {
//   dispatch: {
//     reset: () => void
//     setText: (value: string) => void
//     setFile: (f: string) => void
//     setRecipients: (recipients: Array<string>, hasSBS: boolean) => void
//     setOptions: (includeSelf: boolean, sign: boolean, hideIncludeSelf: boolean) => void
//   }
//   inputType: () => 'file' | 'text'
// }

// export const useEncryptState = Z.createZustand(
//   Z.immerZustand<ZEncryptState>((set, get) => {
//     // const getReduxStore = Z.getReduxStore()
//     const encrypt = () => {
//       const f = async () => {
//         // mobile doesn't run anything automatically
//         if (Platform.isMobile) return
//         if (get().inProgress) return

//         const username = UserConstants.useCurrentUserState.getState().username
//         let rs = get().recipients
//         if (!rs.length) {
//           rs = [username]
//         }
//         console.log('aaa encrypting', get())

//         const inputType = get().inputType()
//         if (inputType === 'file') {
//           // TODO
//         } else {
//           const plaintext = get().text
//           const signed = get().sign
//           try {
//             const res = await RPCTypes.saltpackSaltpackEncryptStringRpcPromise(
//               {
//                 opts: {
//                   includeSelf: get().includeSelf,
//                   recipients: rs,
//                   signed,
//                 },
//                 plaintext,
//               },
//               waitingKey
//             )
//             set(s => {
//               s.outputValid = get().text === plaintext
//               s.errorMessage = ''
//               s.warningMessage = res.usedUnresolvedSBS
//                 ? getWarningMessageForSBS(res.unresolvedSBSAssertion)
//                 : ''
//               s.output = res.ciphertext
//               s.outputSenderUsername = signed ? username : ''
//             })
//           } catch (_error) {
//             if (!(_error instanceof RPCError)) {
//               return
//             }
//             const error = _error
//             logger.error(error)
//             set(s => {
//               s.outputValid = false
//               s.errorMessage = getStatusCodeMessage(error, 'encrypt', 'text')
//               s.warningMessage = ''
//               s.output = ''
//               s.outputSenderUsername = ''
//             })
//           }
//         }
//       }

//       Z.ignorePromise(f())
//     }

//     const dispatch = {
//       onSaltpackStart: () => {
//         set(s => {
//           s.inProgress = true
//         })
//       },
//       reset: () => {
//         set(() => initialEncryptState)
//       },
//       setFile: (f: string) => {
//         set(s => {
//           s.text = ''
//           s.file = f
//           s.outputValid = false
//           s.errorMessage = ''
//           s.warningMessage = ''
//         })

//         encrypt()
//       },
//       setOptions: (includeSelf: boolean, sign: boolean, hideIncludeSelf: boolean) => {
//         set(s => {
//           s.outputValid = false
//           s.includeSelf = includeSelf
//           s.sign = sign
//           s.hideIncludeSelf = hideIncludeSelf
//           // User set themselves as a recipient so don't show the 'includeSelf' option for encrypt (since they're encrypting to themselves)
//           if (hideIncludeSelf) {
//             s.hideIncludeSelf = hideIncludeSelf
//             s.includeSelf = false
//           }
//         })
//       },
//       setRecipients: (recipients: Array<string>, hasSBS: boolean) => {
//         set(s => {
//           s.outputValid = false
//           s.hasSBS = hasSBS
//           // Force signing when user is SBS
//           if (hasSBS) {
//             s.sign = true
//           }
//           s.recipients = recipients
//         })
//       },
//       setText: (value: string) => {
//         set(s => {
//           s.text = value
//           s.file = ''
//           s.outputValid = false
//           s.errorMessage = ''
//           s.warningMessage = ''
//         })

//         encrypt()
//       },
//     }
//     return {
//       ...initialEncryptState,
//       dispatch,
//       inputType: () => (!get().text && get().file ? 'file' : 'text'),
//     }
//   })
// )
