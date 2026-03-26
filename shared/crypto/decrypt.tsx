import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {CryptoBanner, DragAndDrop, Input, InputActionsBar} from './input'
import {CryptoOutput, CryptoOutputActionsBar, CryptoSignedSender} from './output'
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
  outputParamsToCommonState,
  type CommonOutputRouteParams,
  type CryptoInputRouteParams,
  type CommonState,
} from './state'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/core'

const bannerMessage = Crypto.infoMessage.decrypt
const filePrompt = 'Drop a file to decrypt'
const inputEmptyWidth = 320
const inputFileIcon = 'icon-file-saltpack-64' as const
const inputPlaceholder = C.isMobile
  ? 'Enter text to decrypt'
  : 'Enter ciphertext, drop an encrypted file or folder, or'

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

export const useDecryptState = (params?: CryptoInputRouteParams) => {
  const {commitState, state, stateRef} = useCommittedState(() => createCommonState(params))

  const clearInput = React.useCallback(() => {
    commitState(clearInputState(stateRef.current))
  }, [commitState])

  const decrypt = React.useCallback(async (destinationDir = '', snapshot = stateRef.current) => {
    commitState(beginRun(snapshot))
    try {
      if (snapshot.inputType === 'text') {
        const res = await T.RPCGen.saltpackSaltpackDecryptStringRpcPromise(
          {ciphertext: snapshot.input},
          C.waitingKeyCrypto
        )
        const next = onSuccess(
          stateRef.current,
          stateRef.current.input === snapshot.input,
          res.plaintext,
          'text',
          res.signed,
          res.info.sender.username,
          res.info.sender.fullname
        )
        return commitState(next)
      }

      const res = await T.RPCGen.saltpackSaltpackDecryptFileRpcPromise(
        {destinationDir, encryptedFilename: snapshot.input},
        C.waitingKeyCrypto
      )
      const next = onSuccess(
        stateRef.current,
        stateRef.current.input === snapshot.input,
        res.decryptedFilename,
        'file',
        res.signed,
        res.info.sender.username,
        res.info.sender.fullname
      )
      return commitState(next)
    } catch (_error) {
      if (!(_error instanceof RPCError)) throw _error
      logger.error(_error)
      const next = onError(stateRef.current, getStatusCodeMessage(_error, 'decrypt', snapshot.inputType))
      return commitState(next)
    }
  }, [commitState])

  const setInput = React.useCallback(
    (type: T.Crypto.InputTypes, value: string) => {
      if (!value) {
        clearInput()
        return
      }
      const committed = commitState(nextInputState(stateRef.current, type, value))
      maybeAutoRunTextOperation(committed, decrypt)
    },
    [clearInput, commitState, decrypt]
  )

  const openFile = React.useCallback((path: string) => {
    if (!path) return
    const current = stateRef.current
    if (current.inProgress) return
    commitState(nextOpenedFileState(current, path))
  }, [commitState])

  useSeededCryptoInput(params, openFile, setInput)

  return {clearInput, decrypt, openFile, setInput, state}
}

export const DecryptInput = (_props: unknown) => {
  const {params} = useRoute<RootRouteProps<'decryptTab'>>()
  const controller = useDecryptState(params)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const onRun = () => {
    const f = async () => {
      const next = await controller.decrypt()
      if (C.isMobile) {
        navigateAppend({name: Crypto.decryptOutput, params: next})
      }
    }
    C.ignorePromise(f())
  }

  const contents = (
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
  )

  return C.isMobile ? (
    <Kb.KeyboardAvoidingView2>
      {contents}
      <InputActionsBar runLabel="Decrypt" onRun={onRun} />
    </Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
      {contents}
    </Kb.Box2>
  )
}

export const DecryptOutput = ({route}: {route: {params: CommonOutputRouteParams}}) => {
  const state = outputParamsToCommonState(route.params)
  const content = (
    <>
      {C.isMobile && state.errorMessage ? <CryptoBanner key="banner" infoMessage={bannerMessage} state={state} /> : null}
      <CryptoSignedSender key="sender" isSelfSigned={false} state={state} />
      {C.isMobile ? <Kb.Divider key="div" /> : null}
      <CryptoOutput
        key="output"
        actionLabel="Decrypt"
        outputFileIcon="icon-file-64"
        outputTextType="plain"
        state={state}
        onChooseOutputFolder={() => undefined}
      />
      <CryptoOutputActionsBar key="bar" canReplyInChat={true} canSaveAsText={false} state={state} />
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

export const DecryptIO = () => {
  const {params} = useRoute<RootRouteProps<'decryptTab'>>()
  const controller = useDecryptState(params)
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
            actionLabel="Decrypt"
            outputFileIcon="icon-file-64"
            outputTextType="plain"
            state={controller.state}
            onChooseOutputFolder={destinationDir => {
              const f = async () => {
                await controller.decrypt(destinationDir)
              }
              C.ignorePromise(f())
            }}
          />
          <CryptoOutputActionsBar canReplyInChat={true} canSaveAsText={false} state={controller.state} />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
  )
}
