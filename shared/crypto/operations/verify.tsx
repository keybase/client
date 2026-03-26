import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {CryptoBanner, DragAndDrop, Input, InputActionsBar} from '../input'
import {CryptoOutput, CryptoOutputActionsBar, CryptoSignedSender} from '../output'
import {
  createCommonState,
  getStatusCodeMessage,
  outputParamsToCommonState,
  type CommonOutputRouteParams,
  type CryptoInputRouteParams,
  type CommonState,
} from '../state'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/core'

const bannerMessage = Crypto.infoMessage.verify
const filePrompt = 'Drop a file to verify'
const inputEmptyWidth = 342
const inputFileIcon = 'icon-file-saltpack-64' as const
const inputPlaceholder = C.isMobile
  ? 'Enter text to verify'
  : 'Enter a signed message, drop a signed file or folder, or'

const resetWarnings = (state: CommonState): CommonState => ({
  ...state,
  errorMessage: '',
  warningMessage: '',
})

const resetOutput = (state: CommonState): CommonState => ({
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

const beginRun = (state: CommonState): CommonState => ({
  ...resetWarnings(state),
  bytesComplete: 0,
  bytesTotal: 0,
  inProgress: true,
  outputStatus: 'pending',
  outputValid: false,
})

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

const useVerifyState = (params?: CryptoInputRouteParams) => {
  const [state, setState] = React.useState(() => createCommonState(params))
  const stateRef = React.useRef(state)
  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  const clearInput = React.useCallback(() => {
    setState(prev => ({
      ...resetOutput(prev),
      input: '',
      inputType: 'text',
      outputValid: true,
    }))
  }, [])

  const verify = React.useCallback(async (destinationDir = '') => {
    const snapshot = stateRef.current
    setState(prev => beginRun(prev))
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
        setState(next)
        return next
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
      setState(next)
      return next
    } catch (_error) {
      if (!(_error instanceof RPCError)) throw _error
      logger.error(_error)
      const next = onError(stateRef.current, getStatusCodeMessage(_error, 'verify', snapshot.inputType))
      setState(next)
      return next
    }
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
        C.ignorePromise(verify().then(() => undefined))
      }
    },
    [clearInput, verify]
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

  React.useEffect(() => {
    if (!params?.seedInputPath) return
    if ((params.seedInputType ?? 'file') === 'file') {
      openFile(params.seedInputPath)
    } else {
      setInput('text', params.seedInputPath)
    }
  }, [openFile, params?.entryNonce, params?.seedInputPath, params?.seedInputType, setInput])

  return {clearInput, openFile, setInput, state, verify}
}

export const VerifyInput = (_props: unknown) => {
  const {params} = useRoute<RootRouteProps<'verifyTab'>>()
  const controller = useVerifyState(params)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const onRun = () => {
    const f = async () => {
      const next = await controller.verify()
      if (C.isMobile) {
        navigateAppend({name: Crypto.verifyOutput, params: next})
      }
    }
    C.ignorePromise(f())
  }

  const content = (
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
      {C.isMobile ? <InputActionsBar runLabel="Verify" onRun={onRun} /> : null}
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

export const VerifyOutput = ({route}: {route: {params: CommonOutputRouteParams}}) => {
  const state = outputParamsToCommonState(route.params)
  const content = (
    <>
      {C.isMobile && state.errorMessage ? <CryptoBanner key="banner" infoMessage={bannerMessage} state={state} /> : null}
      <CryptoSignedSender isSelfSigned={false} state={state} />
      {C.isMobile ? <Kb.Divider /> : null}
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

  return C.isMobile ? (
    content
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.outputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const VerifyIO = () => {
  const {params} = useRoute<RootRouteProps<'verifyTab'>>()
  const controller = useVerifyState(params)
  return (
    <DragAndDrop
      allowFolders={false}
      prompt={filePrompt}
      inProgress={controller.state.inProgress}
      onAttach={controller.openFile}
    >
      <Kb.Box2 direction="vertical" fullHeight={true}>
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
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.outputDesktopMaxHeight}>
          <CryptoSignedSender isSelfSigned={false} state={controller.state} />
          <CryptoOutput
            actionLabel="Verify"
            outputFileIcon="icon-file-64"
            outputTextType="plain"
            state={controller.state}
            onChooseOutputFolder={destinationDir => {
              C.ignorePromise(controller.verify(destinationDir).then(() => undefined))
            }}
          />
          <CryptoOutputActionsBar canReplyInChat={true} canSaveAsText={false} state={controller.state} />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
  )
}
