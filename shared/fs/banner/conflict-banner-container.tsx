import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as React from 'react'
import * as SettingsConstants from '@/constants/settings'
import type * as T from '@/constants/types'
import ConflictBanner from './conflict-banner'
import openUrl from '@/util/open-url'

type OwnProps = {
  path: T.FS.Path
}

const ConnectedBanner = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _tlf = C.useFSState(s => C.FS.getTlfFromPath(s.tlfs, path))
  const finishManualConflictResolution = C.useFSState(s => s.dispatch.finishManualConflictResolution)
  const startManualConflictResolution = C.useFSState(s => s.dispatch.startManualConflictResolution)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = React.useCallback(() => {
    navigateAppend({
      props: {feedback: `Conflict Resolution failed in \`${path}\`.\n`},
      selected: SettingsConstants.settingsFeedbackTab,
    })
  }, [navigateAppend, path])
  const onFinishResolving = React.useCallback(() => {
    finishManualConflictResolution(path)
  }, [finishManualConflictResolution, path])
  const onGoToSamePathInDifferentTlf = React.useCallback(
    (tlfPath: T.FS.Path) => {
      navigateAppend({props: {path: Constants.rebasePathToDifferentTlf(path, tlfPath)}, selected: 'fsRoot'})
    },
    [navigateAppend, path]
  )
  const onHelp = React.useCallback(() => {
    openUrl('https://book.keybase.io/docs/files/details#conflict-resolution')
  }, [])
  const onStartResolving = React.useCallback(() => {
    startManualConflictResolution(path)
  }, [startManualConflictResolution, path])

  const openPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openPathInSystemFileManagerDesktop
  )

  const openInSystemFileManager = React.useCallback(
    (path: T.FS.Path) => {
      openPathInSystemFileManagerDesktop?.(path)
    },
    [openPathInSystemFileManagerDesktop]
  )

  const props = {
    conflictState: _tlf.conflictState,
    onFeedback,
    onFinishResolving,
    onGoToSamePathInDifferentTlf,
    onHelp,
    onStartResolving,
    openInSystemFileManager,
    tlfPath: Constants.getTlfPath(path),
  }
  return <ConflictBanner {...props} />
}

export default ConnectedBanner
