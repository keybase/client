import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {CryptoBanner, Input, InputActionsBar} from './input'
import OperationIO from './operation-io'
import {KeyboardStickyView} from 'react-native-keyboard-controller'
import {CryptoOutput, CryptoOutputActionsBar, CryptoSignedSender} from './output'
import {
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
  type CommonOutputRouteParams,
  type CryptoInputRouteParams,
  type CommonState,
} from './helpers'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/core'

const bannerMessage = Crypto.infoMessage.verify
const filePrompt = 'Drop a file to verify'
const inputEmptyWidth = 342
const inputFileIcon = 'icon-file-saltpack-64' as const
const inputPlaceholder = isMobile
  ? 'Enter text to verify'
  : 'Enter a signed message, drop a signed file or folder, or'

const onError = (state: CommonState, errorMessage: string): CommonState => ({
  ...resetOutput(state),
  errorMessage,
  inProgress: false,
})

const onSuccess = (
  state: CommonState,
  outputValid: boolean,
  output: string,
  inputType: 'file' | 'text',
  signed: boolean,
  senderUsername: string,
  senderFullname: string
): CommonState => ({
  ...resetWarnings(state),
  inProgress: false,
  output,
  outputSenderFullname: signed ? senderFullname : undefined,
  outputSenderUsername: signed ? senderUsername : undefined,
  outputSigned: signed,
  outputStatus: 'success',
  outputType: inputType,
  outputValid,
})

export const useVerifyState = (params?: CryptoInputRouteParams) => {
  const {commitState, state, stateRef} = useCommittedState(() => createCommonState(params))

  const clearInput = React.useCallback(() => {
    commitState(clearInputState(stateRef.current))
  }, [commitState, stateRef])

  const verify = React.useCallback(async (destinationDir = '', maybeSnapshot?: CommonState) => {
    const snapshot = maybeSnapshot ?? stateRef.current
    commitState(beginRun(snapshot))
    try {
      if (snapshot.inputType === 'text') {
        const res = await T.RPCGen.saltpackSaltpackVerifyStringRpcPromise(
          {signedMsg: snapshot.input},
          C.waitingKeyCrypto
        )
        const next = onSuccess(
          stateRef.current,
          stateRef.current.input === snapshot.input,
          res.plaintext,
          'text',
          res.verified,
          res.sender.username,
          res.sender.fullname
        )
        return commitState(next)
      }

      const res = await T.RPCGen.saltpackSaltpackVerifyFileRpcPromise(
        {destinationDir, signedFilename: snapshot.input},
        C.waitingKeyCrypto
      )
      const next = onSuccess(
        stateRef.current,
        stateRef.current.input === snapshot.input,
        res.verifiedFilename,
        'file',
        res.verified,
        res.sender.username,
        res.sender.fullname
      )
      return commitState(next)
    } catch (_error) {
      if (!(_error instanceof RPCError)) throw _error
      logger.error(_error)
      const next = onError(stateRef.current, getStatusCodeMessage(_error, 'verify', snapshot.inputType))
      return commitState(next)
    }
  }, [commitState, stateRef])

  const setInput = React.useCallback(
    (type: T.Crypto.InputTypes, value: string) => {
      if (!value) {
        clearInput()
        return
      }
      const committed = commitState(nextInputState(stateRef.current, type, value))
      maybeAutoRunTextOperation(committed, verify)
    },
    [clearInput, commitState, verify, stateRef]
  )

  const openFile = React.useCallback((path: string) => {
    if (!path) return
    const current = stateRef.current
    if (current.inProgress) return
    commitState(nextOpenedFileState(current, path))
  }, [commitState, stateRef])

  useSeededCryptoInput(params, openFile, setInput)

  return {clearInput, openFile, setInput, state, verify}
}

export const VerifyInput = (_props: unknown) => {
  const {params} = useRoute() as RootRouteProps<'verifyTab'>
  const controller = useVerifyState(params)
  const navigateAppend = C.Router2.navigateAppend
  const insets = Kb.useSafeAreaInsets()
  const stickyOffset = React.useMemo(() => ({closed: -insets.bottom, opened: 0}), [insets.bottom])

  const onRun = () => {
    const f = async () => {
      const next = await controller.verify()
      if (isMobile) {
        navigateAppend({name: Crypto.verifyOutput, params: next})
      }
    }
    C.ignorePromise(f())
  }

  if (!isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
        <CryptoBanner infoMessage={bannerMessage} state={controller.state} />
        <Input
          allowDirectories={false}
          emptyInputWidth={inputEmptyWidth}
          fileIcon={inputFileIcon}
          inputPlaceholder={inputPlaceholder}
          state={controller.state}
          textInputType="cipher"
          onSetInput={controller.setInput}
          onClearInput={controller.clearInput}
        />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      relative={true}
      testID={TestIDs.CRYPTO_VERIFY_INPUT}
    >
      <CryptoBanner infoMessage={bannerMessage} state={controller.state} />
      <Input
        allowDirectories={false}
        emptyInputWidth={inputEmptyWidth}
        fileIcon={inputFileIcon}
        inputPlaceholder={inputPlaceholder}
        state={controller.state}
        textInputType="cipher"
        onSetInput={controller.setInput}
        onClearInput={controller.clearInput}
      />
      <KeyboardStickyView offset={stickyOffset}>
        <InputActionsBar runLabel="Verify" onRun={onRun} />
      </KeyboardStickyView>
    </Kb.Box2>
  )
}

export const VerifyOutput = ({route}: {route: {params: CommonOutputRouteParams}}) => {
  const state = route.params
  const content = (
    <>
      {isMobile && state.errorMessage ? <CryptoBanner key="banner" infoMessage={bannerMessage} state={state} /> : null}
      <CryptoSignedSender isSelfSigned={false} state={state} />
      {isMobile ? <Kb.Divider /> : null}
      <CryptoOutput
        actionLabel="Verify"
        outputFileIcon="icon-file-64"
        outputTextType="plain"
        state={state}
        onChooseOutputFolder={() => undefined}
      />
      <CryptoOutputActionsBar canReplyInChat={true} canSaveAsText={false} state={state} />
    </>
  )

  return isMobile ? (
    content
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.outputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const VerifyIO = () => {
  const {params} = useRoute() as RootRouteProps<'verifyTab'>
  const controller = useVerifyState(params)
  return (
    <OperationIO
      allowFolders={false}
      divider={true}
      prompt={filePrompt}
      inProgress={controller.state.inProgress}
      onAttach={controller.openFile}
      testID={TestIDs.CRYPTO_VERIFY_INPUT}
      input={
        <>
          <CryptoBanner infoMessage={bannerMessage} state={controller.state} />
          <Input
            allowDirectories={false}
            emptyInputWidth={inputEmptyWidth}
            fileIcon={inputFileIcon}
            inputPlaceholder={inputPlaceholder}
            state={controller.state}
            textInputType="cipher"
            onSetInput={controller.setInput}
            onClearInput={controller.clearInput}
          />
        </>
      }
      output={
        <>
          <CryptoSignedSender isSelfSigned={false} state={controller.state} />
          <CryptoOutput
            actionLabel="Verify"
            outputFileIcon="icon-file-64"
            outputTextType="plain"
            state={controller.state}
            onChooseOutputFolder={destinationDir => C.ignorePromise(controller.verify(destinationDir) as unknown as Promise<void>)}
          />
          <CryptoOutputActionsBar canReplyInChat={true} canSaveAsText={false} state={controller.state} />
        </>
      }
    />
  )
}
