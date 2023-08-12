import * as C from '../../../constants'
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import type * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Container from '../../../util/container'
import {folderNameWithoutUsers} from '../../../util/kbfs'
import Banner, {getHeight} from '.'
import * as RowTypes from '../../browser/rows/types'

type OwnProps = {
  path: Types.Path
}

const ConnectedBanner = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _tlf = C.useFSState(s => C.getTlfFromPath(s.tlfs, path))
  const letResetUserBackIn = C.useFSState(s => s.dispatch.letResetUserBackIn)
  const _onOpenWithoutResetUsers = React.useCallback(
    (currPath: Types.Path, users: {[K in string]: boolean}) => {
      const pathElems = Types.getPathElements(currPath)
      if (pathElems.length < 3) return
      const filteredPathName = folderNameWithoutUsers(pathElems[2] ?? '', users)
      const filteredPath = Types.stringToPath(['', pathElems[0], pathElems[1], filteredPathName].join('/'))
      C.makeActionForOpenPathInFilesTab(filteredPath)
    },
    []
  )
  const _onReAddToTeam = React.useCallback(
    (id: RPCTypes.TeamID, username: string) => {
      letResetUserBackIn(id, username)
    },
    [letResetUserBackIn]
  )
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)

  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onViewProfile = React.useCallback(
    (username: string) => () => {
      Container.isMobile ? showUserProfile(username) : showUser(username, true)
    },
    [showUser, showUserProfile]
  )
  const props = {
    onOpenWithoutResetUsers: () =>
      _onOpenWithoutResetUsers(
        path,
        _tlf.resetParticipants.reduce((acc, i: string) => {
          // @ts-ignore
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

export default ConnectedBanner

export const asRows = (
  path: Types.Path,
  resetBannerType: Types.ResetBannerType
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
    : []
