import * as Constants from '../../constants/fs'
import * as React from 'react'
import * as SettingsConstants from '../../constants/settings'
import * as FsGen from '../../actions/fs-gen'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import type * as Types from '../../constants/types/fs'
import ConflictBanner from './conflict-banner'
import openUrl from '../../util/open-url'

type OwnProps = {
  path: Types.Path
}

const ConnectedBanner = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _tlf = Constants.useState(s => Constants.getTlfFromPath(s.tlfs, path))
  const dispatch = Container.useDispatch()
  const onFeedback = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {feedback: `Conflict Resolution failed in \`${path}\`.\n`},
            selected: SettingsConstants.feedbackTab,
          },
        ],
      })
    )
  }, [dispatch, path])
  const onFinishResolving = React.useCallback(() => {
    dispatch(FsGen.createFinishManualConflictResolution({localViewTlfPath: path}))
  }, [dispatch, path])
  const onGoToSamePathInDifferentTlf = React.useCallback(
    (tlfPath: Types.Path) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {path: Constants.rebasePathToDifferentTlf(path, tlfPath)}, selected: 'fsRoot'}],
        })
      )
    },
    [dispatch, path]
  )
  const onHelp = React.useCallback(() => {
    openUrl('https://book.keybase.io/docs/files/details#conflict-resolution')
  }, [])
  const onStartResolving = React.useCallback(() => {
    dispatch(FsGen.createStartManualConflictResolution({tlfPath: path}))
  }, [dispatch, path])
  const openInSystemFileManager = React.useCallback(
    (path: Types.Path) => {
      dispatch(FsGen.createOpenPathInSystemFileManager({path}))
    },
    [dispatch]
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
