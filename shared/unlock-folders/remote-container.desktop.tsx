import * as C from '../constants'
import * as React from 'react'
import * as Container from '../util/container'
import * as RemoteGen from '../actions/remote-gen'
import UnlockFolders from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {darkMode, devices, waiting, paperKeyError: _error} = state
  const dispatch = Container.useDispatch()
  C.useUFState(s => s.dispatch.replace)(state.devices)
  const phase = C.useUFState(s => s.phase)
  const toPaperKeyInput = C.useUFState(s => s.dispatch.toPaperKeyInput)
  const onBackFromPaperKey = C.useUFState(s => s.dispatch.onBackFromPaperKey)

  const [paperKeyError, setPaperKeyError] = React.useState(_error)
  const lastError = React.useRef(_error)
  if (_error !== lastError.current) {
    lastError.current = _error
    setPaperKeyError(_error)
  }
  const lastPhase = React.useRef(phase)
  if (phase !== lastPhase.current) {
    lastPhase.current = phase
    setPaperKeyError('')
  }

  const onClose = () => {
    dispatch(RemoteGen.createCloseUnlockFolders())
  }

  const onContinueFromPaperKey = (paperKey: string) => {
    dispatch(RemoteGen.createUnlockFoldersSubmitPaperKey({paperKey}))
  }

  return (
    <UnlockFolders
      darkMode={darkMode}
      devices={devices}
      waiting={waiting}
      phase={phase}
      paperkeyError={paperKeyError}
      onBackFromPaperKey={onBackFromPaperKey}
      onClose={onClose}
      onContinueFromPaperKey={onContinueFromPaperKey}
      onFinish={onClose}
      toPaperKeyInput={toPaperKeyInput}
    />
  )
}
export default RemoteContainer
