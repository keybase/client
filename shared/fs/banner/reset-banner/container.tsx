import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {folderNameWithoutUsers} from '@/util/kbfs'
import Banner, {getHeight} from '.'
import * as RowTypes from '@/fs/browser/rows/types'

type OwnProps = {
  path: T.FS.Path
}

const ConnectedBanner = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _tlf = C.useFSState(s => C.FS.getTlfFromPath(s.tlfs, path))
  const letResetUserBackIn = C.useFSState(s => s.dispatch.letResetUserBackIn)
  const _onOpenWithoutResetUsers = React.useCallback(
    (currPath: T.FS.Path, users: {[K in string]: boolean}) => {
      const pathElems = T.FS.getPathElements(currPath)
      if (pathElems.length < 3) return
      const filteredPathName = folderNameWithoutUsers(pathElems[2] ?? '', users)
      const filteredPath = T.FS.stringToPath(['', pathElems[0], pathElems[1], filteredPathName].join('/'))
      C.FS.makeActionForOpenPathInFilesTab(filteredPath)
    },
    []
  )
  const _onReAddToTeam = React.useCallback(
    (id: T.RPCGen.TeamID, username: string) => {
      letResetUserBackIn(id, username)
    },
    [letResetUserBackIn]
  )
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)

  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onViewProfile = React.useCallback(
    (username: string) => () => {
      C.isMobile ? showUserProfile(username) : showUser(username, true)
    },
    [showUser, showUserProfile]
  )
  const props = {
    onOpenWithoutResetUsers: () =>
      _onOpenWithoutResetUsers(
        path,
        _tlf.resetParticipants.reduce<{
          [x: string]: boolean
        }>((acc, i: string) => {
          acc[i] = true
          return acc
        }, {})
      ),
    onReAddToTeam: (username: string) => () =>
      _tlf.teamId ? _onReAddToTeam(_tlf.teamId, username) : undefined,
    onViewProfile,
    path,
    resetParticipants: _tlf.resetParticipants,
  }
  return <Banner {...props} />
}

const noRows = new Array<RowTypes.HeaderRowItem>()
export const asRows = (
  path: T.FS.Path,
  resetBannerType: T.FS.ResetBannerType
): Array<RowTypes.HeaderRowItem> =>
  typeof resetBannerType === 'number'
    ? [
        {
          height: getHeight(resetBannerType),
          key: 'reset-banner',
          node: <ConnectedBanner path={path} />,
          rowType: RowTypes.RowType.Header,
        },
      ]
    : noRows
