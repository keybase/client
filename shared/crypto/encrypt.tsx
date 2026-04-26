import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import Recipients from './recipients'
import {openURL} from '@/util/misc'
import {CryptoBanner, DragAndDrop, Input, InputActionsBar} from './input'
import {CryptoOutput, CryptoOutputActionsBar, CryptoSignedSender, OutputInfoBanner} from './output'
import {
  type CommonOutputRouteParams,
  type CryptoInputRouteParams,
  beginRun,
  clearInputState,
  createCommonState,
  getStatusCodeMessage,
  maybeAutoRunTextOperation,
  nextInputState,
  nextOpenedFileState,
  resetOutput,
  resetWarnings,
  useCommittedState,
  useSeededCryptoInput,
} from './helpers'
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

export type EncryptOptions = {
  includeSelf: boolean
  sign: boolean
}

export type EncryptMeta = {
  hasRecipients: boolean
  hasSBS: boolean
  hideIncludeSelf: boolean
}

export type EncryptState = CommonOutputRouteParams & {
  meta: EncryptMeta
  options: EncryptOptions
  recipients: Array<string>
}

export type CryptoTeamBuilderResult = Array<{
  serviceId: T.TB.ServiceIdWithContact
  username: string
}>

export type EncryptRouteParams = CryptoInputRouteParams & {
  teamBuilderNonce?: string | undefined
  teamBuilderUsers?: CryptoTeamBuilderResult | undefined
}

export type EncryptOutputRouteParams = CommonOutputRouteParams & {
  hasRecipients: boolean
  includeSelf: boolean
  recipients: Array<string>
}

export const createEncryptState = (params?: EncryptRouteParams): EncryptState => ({
  ...createCommonState(params),
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
})

export const encryptToOutputParams = (state: EncryptState): EncryptOutputRouteParams => ({
  ...state,
  hasRecipients: state.meta.hasRecipients,
  includeSelf: state.options.includeSelf,
  recipients: state.recipients,
})

export const teamBuilderResultToRecipients = (
  users: ReadonlyArray<{serviceId: T.TB.ServiceIdWithContact; username: string}>
) => {
  let hasSBS = false
  const recipients = users.map(user => {
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
  return {hasSBS, recipients}
}

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

export const useEncryptScreenState = (params?: EncryptRouteParams) => {
  const {commitState, state, stateRef} = useCommittedState(() => createEncryptState(params))
  const handledTeamBuilderNonceRef = React.useRef<string | undefined>(undefined)

  const runEncrypt = React.useCallback(async (destinationDir = '', snapshot = stateRef.current) => {
    const username = useCurrentUserState.getState().username
    const signed = snapshot.options.sign
    const opts = {
      includeSelf: snapshot.options.includeSelf,
      recipients: snapshot.recipients.length ? snapshot.recipients : [username],
      signed,
    }

    commitState(beginRun(snapshot))
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
      return commitState(next)
    } catch (_error) {
      if (!(_error instanceof RPCError)) throw _error
      logger.error(_error)
      const next = onError(stateRef.current, getStatusCodeMessage(_error, 'encrypt', snapshot.inputType))
      return commitState(next)
    }
  }, [commitState, stateRef])

  const clearInput = React.useCallback(() => {
    commitState(clearInputState(stateRef.current))
  }, [commitState, stateRef])

  const setInput = React.useCallback(
    (type: T.Crypto.InputTypes, value: string) => {
      if (!value) {
        clearInput()
        return
      }
      const committed = commitState(nextInputState(stateRef.current, type, value))
      maybeAutoRunTextOperation(committed, runEncrypt)
    },
    [clearInput, commitState, runEncrypt, stateRef]
  )

  const openFile = React.useCallback((path: string) => {
    if (!path) return
    const current = stateRef.current
    if (current.inProgress) return
    commitState(nextOpenedFileState(current, path))
  }, [commitState, stateRef])

  const setRecipients = React.useCallback(
    (recipients: ReadonlyArray<string>, hasSBS: boolean) => {
      const committed = commitState(nextRecipientState(stateRef.current, recipients, hasSBS))
      maybeAutoRunTextOperation(committed, runEncrypt)
    },
    [commitState, runEncrypt, stateRef]
  )

  const clearRecipients = React.useCallback(() => {
    const next = resetOutput(stateRef.current)
    commitState({
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
    })
  }, [commitState, stateRef])

  const setEncryptOptions = React.useCallback(
    (options: {includeSelf?: boolean; sign?: boolean}, hideIncludeSelf?: boolean) => {
      const committed = commitState(nextOptionState(stateRef.current, options, hideIncludeSelf))
      maybeAutoRunTextOperation(committed, runEncrypt)
    },
    [commitState, runEncrypt, stateRef]
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
    return commitState(next)
  }, [commitState, stateRef])

  useSeededCryptoInput(params, openFile, setInput)

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

const EncryptOptionsPanel = ({
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
  outputStatus?: EncryptOutputRouteParams['outputStatus'] | undefined
  outputType?: EncryptOutputRouteParams['outputType'] | undefined
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
  const navigateAppend = C.Router2.navigateAppend
  const appendEncryptRecipientsBuilder = C.Router2.appendEncryptRecipientsBuilder
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
      <EncryptOptionsPanel
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
    <EncryptOptionsPanel
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
    <CryptoSignedSender isSelfSigned={true} state={params} />
    {C.isMobile ? <Kb.Divider /> : null}
    <CryptoOutput
      actionLabel="Encrypt"
      outputFileIcon="icon-file-saltpack-64"
      outputTextType="cipher"
      state={params}
      onChooseOutputFolder={() => undefined}
    />
    <CryptoOutputActionsBar
      canReplyInChat={false}
      canSaveAsText={true}
      state={params}
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
  const appendEncryptRecipientsBuilder = C.Router2.appendEncryptRecipientsBuilder

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
          <EncryptOptionsPanel
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
