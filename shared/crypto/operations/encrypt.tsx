import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import Recipients from '../recipients'
import {openURL} from '@/util/misc'
import {CryptoBanner, DragAndDrop, Input, InputActionsBar} from '../input'
import {CryptoOutput, CryptoOutputActionsBar, CryptoSignedSender, OutputInfoBanner} from '../output'
import {
  createEncryptState,
  encryptToOutputParams,
  getStatusCodeMessage,
  outputParamsToCommonState,
  teamBuilderResultToRecipients,
  type EncryptOutputRouteParams,
  type EncryptRouteParams,
  type EncryptState,
} from '../state'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/core'

const bannerMessage = Crypto.infoMessage.encrypt
const filePrompt = 'Drop a file to encrypt'
const inputEmptyWidth = 207
const inputFileIcon = 'icon-file-64' as const
const inputPlaceholder = C.isMobile ? 'Enter text to encrypt' : 'Enter text, drop a file or folder, or'

const getWarningMessageForSBS = (sbsAssertion: string) =>
  `Note: Encrypted for "${sbsAssertion}" who is not yet a Keybase user. One of your devices will need to be online after they join Keybase in order for them to decrypt the message.`

const resetWarnings = (state: EncryptState): EncryptState => ({
  ...state,
  errorMessage: '',
  warningMessage: '',
})

const resetOutput = (state: EncryptState): EncryptState => ({
  ...resetWarnings(state),
  bytesComplete: 0,
  bytesTotal: 0,
  output: '',
  outputSenderFullname: undefined,
  outputSenderUsername: undefined,
  outputSigned: false,
  outputStatus: undefined,
  outputType: undefined,
  outputValid: false,
})

const beginRun = (state: EncryptState): EncryptState => ({
  ...resetWarnings(state),
  bytesComplete: 0,
  bytesTotal: 0,
  inProgress: true,
  outputStatus: 'pending',
  outputValid: false,
})

const onError = (state: EncryptState, errorMessage: string): EncryptState => ({
  ...resetOutput(state),
  errorMessage,
  inProgress: false,
})

const onSuccess = (
  state: EncryptState,
  outputValid: boolean,
  warningMessage: string,
  output: string,
  inputType: 'file' | 'text',
  signed: boolean,
  senderUsername: string
): EncryptState => ({
  ...resetWarnings(state),
  inProgress: false,
  output,
  outputSenderFullname: undefined,
  outputSenderUsername: signed ? senderUsername : undefined,
  outputSigned: signed,
  outputStatus: 'success',
  outputType: inputType,
  outputValid,
  warningMessage,
})

const nextRecipientState = (
  state: EncryptState,
  recipients: ReadonlyArray<string>,
  hasSBS: boolean
): EncryptState => {
  const currentUser = useCurrentUserState.getState().username
  const hideIncludeSelf = recipients.includes(currentUser) && !hasSBS
  const next = state.inputType === 'file' ? resetOutput(state) : resetWarnings(state)
  return {
    ...next,
    meta: {
      hasRecipients: recipients.length > 0,
      hasSBS,
      hideIncludeSelf,
    },
    options: {
      includeSelf: hasSBS ? true : hideIncludeSelf ? false : next.options.includeSelf,
      sign: hasSBS ? true : next.options.sign,
    },
    outputValid: false,
    recipients: [...recipients],
  }
}

const nextOptionState = (
  state: EncryptState,
  newOptions: {includeSelf?: boolean; sign?: boolean},
  hideIncludeSelf?: boolean
): EncryptState => {
  const next = state.inputType === 'file' ? resetOutput(state) : resetWarnings(state)
  return {
    ...next,
    meta: {
      ...next.meta,
      hideIncludeSelf: hideIncludeSelf ?? next.meta.hideIncludeSelf,
    },
    options: {
      ...next.options,
      ...newOptions,
      ...(hideIncludeSelf ? {includeSelf: false} : {}),
    },
    outputValid: false,
  }
}

const useEncryptScreenState = (params?: EncryptRouteParams) => {
  const [state, setState] = React.useState(() => createEncryptState(params))
  const stateRef = React.useRef(state)
  const handledTeamBuilderNonceRef = React.useRef<string | undefined>(undefined)

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  const runEncrypt = React.useCallback(async (destinationDir = '') => {
    const snapshot = stateRef.current
    const username = useCurrentUserState.getState().username
    const signed = snapshot.options.sign
    const opts = {
      includeSelf: snapshot.options.includeSelf,
      recipients: snapshot.recipients.length ? snapshot.recipients : [username],
      signed,
    }

    setState(prev => beginRun(prev))
    try {
      let output = ''
      let unresolvedSBSAssertion = ''
      let usedUnresolvedSBS = false
      if (snapshot.inputType === 'text') {
        const result = await T.RPCGen.saltpackSaltpackEncryptStringRpcPromise(
          {opts, plaintext: snapshot.input},
          C.waitingKeyCrypto
        )
        output = result.ciphertext
        unresolvedSBSAssertion = result.unresolvedSBSAssertion
        usedUnresolvedSBS = result.usedUnresolvedSBS
      } else {
        const result = await T.RPCGen.saltpackSaltpackEncryptFileRpcPromise(
          {destinationDir, filename: snapshot.input, opts},
          C.waitingKeyCrypto
        )
        output = result.filename
        unresolvedSBSAssertion = result.unresolvedSBSAssertion
        usedUnresolvedSBS = result.usedUnresolvedSBS
      }

      const next = onSuccess(
        stateRef.current,
        stateRef.current.input === snapshot.input,
        usedUnresolvedSBS ? getWarningMessageForSBS(unresolvedSBSAssertion) : '',
        output,
        snapshot.inputType,
        signed,
        username
      )
      setState(next)
      return next
    } catch (_error) {
      if (!(_error instanceof RPCError)) throw _error
      logger.error(_error)
      const next = onError(stateRef.current, getStatusCodeMessage(_error, 'encrypt', snapshot.inputType))
      setState(next)
      return next
    }
  }, [])

  const clearInput = React.useCallback(() => {
    setState(prev => ({
      ...resetOutput(prev),
      input: '',
      inputType: 'text',
      outputValid: true,
    }))
  }, [])

  const setInput = React.useCallback(
    (type: T.Crypto.InputTypes, value: string) => {
      if (!value) {
        clearInput()
        return
      }
      setState(prev => {
        const outputValid = prev.input === value
        const next = {
          ...resetWarnings(prev),
          input: value,
          inputType: type,
          outputValid,
        }
        return type === 'file' ? resetOutput(next) : next
      })
      if (type === 'text' && !C.isMobile) {
        const f = async () => {
          await runEncrypt()
        }
        C.ignorePromise(f())
      }
    },
    [clearInput, runEncrypt]
  )

  const openFile = React.useCallback((path: string) => {
    if (!path) return
    setState(prev => {
      if (prev.inProgress) return prev
      return {
        ...resetOutput(prev),
        input: path,
        inputType: 'file',
      }
    })
  }, [])

  const setRecipients = React.useCallback(
    (recipients: ReadonlyArray<string>, hasSBS: boolean) => {
      setState(prev => nextRecipientState(prev, recipients, hasSBS))
      if (stateRef.current.inputType === 'text' && !C.isMobile) {
        const f = async () => {
          await runEncrypt()
        }
        C.ignorePromise(f())
      }
    },
    [runEncrypt]
  )

  const clearRecipients = React.useCallback(() => {
    setState(prev => {
      const next = resetOutput(prev)
      return {
        ...next,
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
      }
    })
  }, [])

  const setEncryptOptions = React.useCallback(
    (options: {includeSelf?: boolean; sign?: boolean}, hideIncludeSelf?: boolean) => {
      setState(prev => nextOptionState(prev, options, hideIncludeSelf))
      if (stateRef.current.inputType === 'text' && !C.isMobile) {
        const f = async () => {
          await runEncrypt()
        }
        C.ignorePromise(f())
      }
    },
    [runEncrypt]
  )

  const saveOutputAsText = React.useCallback(async () => {
    const output = await T.RPCGen.saltpackSaltpackSaveCiphertextToFileRpcPromise({
      ciphertext: stateRef.current.output,
    })
    const next = {
      ...resetWarnings(stateRef.current),
      output,
      outputStatus: 'success' as const,
      outputType: 'file' as const,
    }
    setState(next)
    return next
  }, [])

  React.useEffect(() => {
    if (!params?.seedInputPath) return
    if ((params.seedInputType ?? 'file') === 'file') {
      openFile(params.seedInputPath)
    } else {
      setInput('text', params.seedInputPath)
    }
  }, [openFile, params?.entryNonce, params?.seedInputPath, params?.seedInputType, setInput])

  React.useEffect(() => {
    if (!params?.teamBuilderNonce || !params.teamBuilderUsers) return
    if (handledTeamBuilderNonceRef.current === params.teamBuilderNonce) return
    handledTeamBuilderNonceRef.current = params.teamBuilderNonce
    const {hasSBS, recipients} = teamBuilderResultToRecipients(params.teamBuilderUsers)
    setRecipients(recipients, hasSBS)
  }, [params?.teamBuilderNonce, params?.teamBuilderUsers, setRecipients])

  return {
    clearInput,
    clearRecipients,
    openFile,
    runEncrypt,
    saveOutputAsText,
    setEncryptOptions,
    setInput,
    state,
  }
}

const EncryptOptions = ({
  hasRecipients,
  hasSBS,
  hideIncludeSelf,
  includeSelf,
  inProgress,
  sign,
  setEncryptOptions,
}: {
  hasRecipients: boolean
  hasSBS: boolean
  hideIncludeSelf: boolean
  includeSelf: boolean
  inProgress: boolean
  setEncryptOptions: (options: {includeSelf?: boolean; sign?: boolean}, hideIncludeSelf?: boolean) => void
  sign: boolean
}) => {
  const onSetOptions = (opts: {newIncludeSelf: boolean; newSign: boolean}) => {
    const {newIncludeSelf, newSign} = opts
    setEncryptOptions({includeSelf: newIncludeSelf, sign: newSign})
  }

  const direction = Kb.Styles.isTablet ? 'horizontal' : Kb.Styles.isMobile ? 'vertical' : 'horizontal'
  const gap = Kb.Styles.isTablet ? 'medium' : Kb.Styles.isMobile ? 'xtiny' : 'medium'

  return (
    <Kb.Box2
      direction={direction}
      fullWidth={true}
      centerChildren={Kb.Styles.isTablet}
      gap={gap}
      style={styles.optionsContainer}
    >
      {hideIncludeSelf ? null : (
        <Kb.Checkbox
          label="Include yourself"
          disabled={inProgress || hasSBS || !hasRecipients}
          checked={hasSBS || includeSelf}
          onCheck={newValue => onSetOptions({newIncludeSelf: newValue, newSign: sign})}
        />
      )}
      <Kb.Checkbox
        label="Sign"
        disabled={inProgress || hasSBS}
        checked={sign}
        onCheck={newValue => onSetOptions({newIncludeSelf: includeSelf, newSign: newValue})}
      />
    </Kb.Box2>
  )
}

const EncryptOutputBanner = ({
  hasRecipients,
  includeSelf,
  outputStatus,
  outputType,
  recipients,
}: {
  hasRecipients: boolean
  includeSelf: boolean
  outputStatus?: EncryptOutputRouteParams['outputStatus']
  outputType?: EncryptOutputRouteParams['outputType']
  recipients: ReadonlyArray<string>
}) => {
  const youAnd = (who: string) => (includeSelf ? `you and ${who}` : who)
  const whoCanRead = hasRecipients
    ? ` Only ${recipients.length > 1 ? youAnd('your recipients') : youAnd(recipients[0] ?? '')} can decipher it.`
    : ''

  const paragraphs: Array<React.ReactElement<typeof Kb.BannerParagraph>> = []
  paragraphs.push(
    <Kb.BannerParagraph
      key="saltpackDisclaimer"
      bannerColor="grey"
      content={[
        'This is your encrypted ',
        outputType === 'file' ? 'file' : 'message',
        ', using ',
        {
          onClick: () => openURL(Crypto.saltpackDocumentation),
          text: 'Saltpack',
        },
        '.',
        outputType === 'text' ? " It's also called ciphertext." : '',
      ]}
    />
  )
  if (hasRecipients) {
    paragraphs.push(
      <Kb.BannerParagraph
        key="whoCanRead"
        bannerColor="grey"
        content={[' Share it however you like.', whoCanRead]}
      />
    )
  }

  return <OutputInfoBanner outputStatus={outputStatus}>{paragraphs}</OutputInfoBanner>
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      optionsContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.small),
          alignItems: 'center',
          height: 40,
        },
        isMobile: {
          alignItems: 'flex-start',
        },
        isTablet: {
          ...Kb.Styles.globalStyles.fullWidth,
          alignSelf: 'center',
          justifyContent: 'space-between',
          maxWidth: 460,
        },
      }),
    }) as const
)

const EncryptInputBody = ({params}: {params?: EncryptRouteParams}) => {
  const controller = useEncryptScreenState(params)
  const blurCBRef = React.useRef(() => {})
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const appendEncryptRecipientsBuilder = C.useRouterState(s => s.appendEncryptRecipientsBuilder)
  const setBlurCB = (cb: () => void) => {
    blurCBRef.current = cb
  }

  const onRun = () => {
    const f = async () => {
      const next = await controller.runEncrypt()
      if (C.isMobile) {
        navigateAppend({name: Crypto.encryptOutput, params: encryptToOutputParams(next)})
      }
    }
    C.ignorePromise(f())
  }

  const options = C.isMobile ? (
    <InputActionsBar runLabel="Encrypt" blurCBRef={blurCBRef} onRun={onRun}>
      <EncryptOptions
        hasRecipients={controller.state.meta.hasRecipients}
        hasSBS={controller.state.meta.hasSBS}
        hideIncludeSelf={controller.state.meta.hideIncludeSelf}
        includeSelf={controller.state.options.includeSelf}
        inProgress={controller.state.inProgress}
        setEncryptOptions={controller.setEncryptOptions}
        sign={controller.state.options.sign}
      />
    </InputActionsBar>
  ) : (
    <EncryptOptions
      hasRecipients={controller.state.meta.hasRecipients}
      hasSBS={controller.state.meta.hasSBS}
      hideIncludeSelf={controller.state.meta.hideIncludeSelf}
      includeSelf={controller.state.options.includeSelf}
      inProgress={controller.state.inProgress}
      setEncryptOptions={controller.setEncryptOptions}
      sign={controller.state.options.sign}
    />
  )

  const content = (
    <>
      <CryptoBanner infoMessage={bannerMessage} state={controller.state} />
      <Recipients
        recipients={controller.state.recipients}
        inProgress={controller.state.inProgress}
        onAddRecipients={appendEncryptRecipientsBuilder}
        onClearRecipients={controller.clearRecipients}
      />
      <Input
        allowDirectories={true}
        emptyInputWidth={inputEmptyWidth}
        fileIcon={inputFileIcon}
        inputPlaceholder={inputPlaceholder}
        state={controller.state}
        setBlurCB={setBlurCB}
        textInputType="plain"
        onSetInput={controller.setInput}
        onClearInput={controller.clearInput}
      />
      {options}
    </>
  )

  return C.isMobile ? (
    <Kb.KeyboardAvoidingView2>{content}</Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

const EncryptOutputBody = ({params}: {params: EncryptOutputRouteParams}) => (
  <Kb.Box2
    direction="vertical"
    fullHeight={true}
    style={C.isMobile ? undefined : Crypto.outputDesktopMaxHeight}
  >
    <EncryptOutputBanner
      hasRecipients={params.hasRecipients}
      includeSelf={params.includeSelf}
      outputStatus={params.outputStatus}
      outputType={params.outputType}
      recipients={params.recipients}
    />
    <CryptoSignedSender isSelfSigned={true} state={outputParamsToCommonState(params)} />
    {C.isMobile ? <Kb.Divider /> : null}
    <CryptoOutput
      actionLabel="Encrypt"
      outputFileIcon="icon-file-saltpack-64"
      outputTextType="cipher"
      state={outputParamsToCommonState(params)}
      onChooseOutputFolder={() => undefined}
    />
    <CryptoOutputActionsBar
      canReplyInChat={false}
      canSaveAsText={true}
      state={outputParamsToCommonState(params)}
    />
  </Kb.Box2>
)

export const EncryptInput = (_props: unknown) => {
  const {params} = useRoute<RootRouteProps<'encryptTab'>>()
  return <EncryptInputBody params={params} />
}

export const EncryptOutput = ({route}: {route: {params: EncryptOutputRouteParams}}) => {
  return <EncryptOutputBody params={route.params} />
}

export const EncryptIO = () => {
  const {params} = useRoute<RootRouteProps<'encryptTab'>>()
  const controller = useEncryptScreenState(params)
  const appendEncryptRecipientsBuilder = C.useRouterState(s => s.appendEncryptRecipientsBuilder)

  return (
    <DragAndDrop allowFolders={true} prompt={filePrompt} inProgress={controller.state.inProgress} onAttach={controller.openFile}>
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
          <CryptoBanner infoMessage={bannerMessage} state={controller.state} />
          <Recipients
            recipients={controller.state.recipients}
            inProgress={controller.state.inProgress}
            onAddRecipients={appendEncryptRecipientsBuilder}
            onClearRecipients={controller.clearRecipients}
          />
          <Input
            allowDirectories={true}
            emptyInputWidth={inputEmptyWidth}
            fileIcon={inputFileIcon}
            inputPlaceholder={inputPlaceholder}
            state={controller.state}
            textInputType="plain"
            onSetInput={controller.setInput}
            onClearInput={controller.clearInput}
          />
          <EncryptOptions
            hasRecipients={controller.state.meta.hasRecipients}
            hasSBS={controller.state.meta.hasSBS}
            hideIncludeSelf={controller.state.meta.hideIncludeSelf}
            includeSelf={controller.state.options.includeSelf}
            inProgress={controller.state.inProgress}
            setEncryptOptions={controller.setEncryptOptions}
            sign={controller.state.options.sign}
          />
        </Kb.Box2>
        <Kb.Box2
          direction="vertical"
          fullHeight={true}
          style={C.isMobile ? undefined : Crypto.outputDesktopMaxHeight}
        >
          <EncryptOutputBanner
            hasRecipients={controller.state.meta.hasRecipients}
            includeSelf={controller.state.options.includeSelf}
            outputStatus={controller.state.outputStatus}
            outputType={controller.state.outputType}
            recipients={controller.state.recipients}
          />
          <CryptoSignedSender isSelfSigned={true} state={controller.state} />
          {C.isMobile ? <Kb.Divider /> : null}
          <CryptoOutput
            actionLabel="Encrypt"
            outputFileIcon="icon-file-saltpack-64"
            outputTextType="cipher"
            state={controller.state}
            onChooseOutputFolder={destinationDir => {
              const f = async () => {
                await controller.runEncrypt(destinationDir)
              }
              C.ignorePromise(f())
            }}
          />
          <CryptoOutputActionsBar
            canReplyInChat={false}
            canSaveAsText={true}
            state={controller.state}
            onSaveAsText={() => {
              const f = async () => {
                await controller.saveOutputAsText()
              }
              C.ignorePromise(f())
            }}
          />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
  )
}
