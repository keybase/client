import * as R from '@/constants/remote'
import * as React from 'react'
import * as RemoteGen from '../actions/remote-gen'
import UnlockFolders from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useUnlockFoldersState as useUFState} from '@/stores/unlock-folders'
import {useDarkModeState} from '@/stores/darkmode'

const RemoteContainer = (d: DeserializeProps) => {
  const {darkMode, devices, waiting, paperKeyError: _error} = d
  useUFState(s => s.dispatch.replace)(devices)
  const phase = useUFState(s => s.phase)
  const toPaperKeyInput = useUFState(s => s.dispatch.toPaperKeyInput)
  const onBackFromPaperKey = useUFState(s => s.dispatch.onBackFromPaperKey)
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)

  const [paperKeyError, setPaperKeyError] = React.useState(_error)
  const lastError = React.useRef(_error)
  React.useEffect(() => {
    if (_error !== lastError.current) {
      lastError.current = _error
      setPaperKeyError(_error)
    }
  }, [_error])

  const lastPhase = React.useRef(phase)
  React.useEffect(() => {
    if (phase !== lastPhase.current) {
      lastPhase.current = phase
      setPaperKeyError('')
    }
  }, [phase])

  const onClose = () => {
    R.remoteDispatch(RemoteGen.createCloseUnlockFolders())
  }

  const onContinueFromPaperKey = (paperKey: string) => {
    R.remoteDispatch(RemoteGen.createUnlockFoldersSubmitPaperKey({paperKey}))
  }

  React.useEffect(() => {
    const id = setTimeout(() => {
      setSystemDarkMode(darkMode)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [setSystemDarkMode, darkMode])

  return (
    <UnlockFolders
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
