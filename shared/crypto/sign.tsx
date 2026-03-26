import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {openURL} from '@/util/misc'
import {CryptoBanner, DragAndDrop, Input, InputActionsBar} from './input'
import {CryptoOutput, CryptoOutputActionsBar, CryptoSignedSender, OutputInfoBanner} from './output'
import {
  beginRun,
  clearInputState,
  maybeAutoRunTextOperation,
  nextInputState,
  nextOpenedFileState,
  resetOutput,
  resetWarnings,
  useCommittedState,
  useSeededCryptoInput,
} from './helpers'
import {
  createCommonState,
  getStatusCodeMessage,
  type CommonOutputRouteParams,
  type CryptoInputRouteParams,
  type CommonState,
} from './helpers'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/core'

const bannerMessage = Crypto.infoMessage.sign
const filePrompt = 'Drop a file to sign'
const inputEmptyWidth = 207
const inputFileIcon = 'icon-file-64' as const
const inputPlaceholder = C.isMobile ? 'Enter text to sign' : 'Enter text, drop a file or folder, or'

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
  username: string
): CommonState => ({
  ...resetWarnings(state),
  inProgress: false,
  output,
  outputSenderUsername: username,
  outputSigned: true,
  outputStatus: 'success',
  outputType: inputType,
  outputValid,
})

export const useSignState = (params?: CryptoInputRouteParams) => {
  const {commitState, state, stateRef} = useCommittedState(() => createCommonState(params))

  const clearInput = React.useCallback(() => {
    commitState(clearInputState(stateRef.current))
  }, [commitState, stateRef])

  const sign = React.useCallback(async (destinationDir = '', snapshot = stateRef.current) => {
    commitState(beginRun(snapshot))
    try {
      const username = useCurrentUserState.getState().username
      const output =
        snapshot.inputType === 'text'
          ? await T.RPCGen.saltpackSaltpackSignStringRpcPromise(
              {plaintext: snapshot.input},
              C.waitingKeyCrypto
            )
          : await T.RPCGen.saltpackSaltpackSignFileRpcPromise(
              {destinationDir, filename: snapshot.input},
              C.waitingKeyCrypto
            )
      const next = onSuccess(
        stateRef.current,
        stateRef.current.input === snapshot.input,
        output,
        snapshot.inputType,
        username
      )
      return commitState(next)
    } catch (_error) {
      if (!(_error instanceof RPCError)) throw _error
      logger.error(_error)
      const next = onError(stateRef.current, getStatusCodeMessage(_error, 'sign', snapshot.inputType))
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
      maybeAutoRunTextOperation(committed, sign)
    },
    [clearInput, commitState, sign, stateRef]
  )

  const openFile = React.useCallback((path: string) => {
    if (!path) return
    const current = stateRef.current
    if (current.inProgress) return
    commitState(nextOpenedFileState(current, path))
  }, [commitState, stateRef])

  const saveOutputAsText = React.useCallback(async () => {
    const output = await T.RPCGen.saltpackSaltpackSaveSignedMsgToFileRpcPromise({signedMsg: stateRef.current.output})
    const next = {
      ...resetWarnings(stateRef.current),
      output,
      outputStatus: 'success' as const,
      outputType: 'file' as const,
    }
    return commitState(next)
  }, [commitState, stateRef])

  useSeededCryptoInput(params, openFile, setInput)

  return {clearInput, openFile, saveOutputAsText, setInput, sign, state}
}

const SignOutputBanner = ({state}: {state: CommonOutputRouteParams}) => (
  <OutputInfoBanner outputStatus={state.outputStatus}>
    <Kb.Text type="BodySmallSemibold" center={true}>
      This is your signed {state.outputType === 'file' ? 'file' : 'message'}, using{' '}
      <Kb.Text type="BodySecondaryLink" underline={true} onClick={() => openURL(Crypto.saltpackDocumentation)}>
        Saltpack
      </Kb.Text>
      . Anyone who has it can verify you signed it.
    </Kb.Text>
  </OutputInfoBanner>
)

export const SignInput = (_props: unknown) => {
  const {params} = useRoute<RootRouteProps<'signTab'>>()
  const controller = useSignState(params)
  const blurCBRef = React.useRef(() => {})
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const setBlurCB = (cb: () => void) => {
    blurCBRef.current = cb
  }

  const onRun = () => {
    const f = async () => {
      const next = await controller.sign()
      if (C.isMobile) {
        navigateAppend({name: Crypto.signOutput, params: next})
      }
    }
    C.ignorePromise(f())
  }

  const content = (
    <>
      <CryptoBanner infoMessage={bannerMessage} state={controller.state} />
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
      {C.isMobile ? <InputActionsBar runLabel="Sign" blurCBRef={blurCBRef} onRun={onRun} /> : null}
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

export const SignOutput = ({route}: {route: {params: CommonOutputRouteParams}}) => {
  const state = route.params
  const content = (
    <>
      <SignOutputBanner state={route.params} />
      <CryptoSignedSender isSelfSigned={true} state={state} />
      {C.isMobile ? <Kb.Divider /> : null}
      <CryptoOutput
        actionLabel="Sign"
        outputFileIcon="icon-file-saltpack-64"
        outputTextType="cipher"
        state={state}
        onChooseOutputFolder={() => undefined}
      />
      <CryptoOutputActionsBar canReplyInChat={false} canSaveAsText={true} state={state} />
    </>
  )

  return C.isMobile ? (
    content
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.outputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const SignIO = () => {
  const {params} = useRoute<RootRouteProps<'signTab'>>()
  const controller = useSignState(params)
  return (
    <DragAndDrop
      allowFolders={true}
      prompt={filePrompt}
      inProgress={controller.state.inProgress}
      onAttach={controller.openFile}
    >
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
          <CryptoBanner infoMessage={bannerMessage} state={controller.state} />
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
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.outputDesktopMaxHeight}>
          <SignOutputBanner state={controller.state} />
          <CryptoSignedSender isSelfSigned={true} state={controller.state} />
          <CryptoOutput
            actionLabel="Sign"
            outputFileIcon="icon-file-saltpack-64"
            outputTextType="cipher"
            state={controller.state}
            onChooseOutputFolder={destinationDir => {
              const f = async () => {
                await controller.sign(destinationDir)
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
