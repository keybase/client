import * as ProfileGen from '../../../actions/profile-gen'
import * as React from 'react'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as Constants from '../../../constants/fs'
import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
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
  const _tlf = Container.useSelector(state => Constants.getTlfFromPath(state.fs.tlfs, path))
  const dispatch = Container.useDispatch()
  const _onOpenWithoutResetUsers = React.useCallback(
    (currPath: Types.Path, users: {[K in string]: boolean}) => {
      const pathElems = Types.getPathElements(currPath)
      if (pathElems.length < 3) return
      const filteredPathName = folderNameWithoutUsers(pathElems[2], users)
      const filteredPath = Types.stringToPath(['', pathElems[0], pathElems[1], filteredPathName].join('/'))
      dispatch(Constants.makeActionForOpenPathInFilesTab(filteredPath))
    },
    [dispatch]
  )
  const _onReAddToTeam = React.useCallback(
    (id: RPCTypes.TeamID, username: string) => {
      dispatch(FsGen.createLetResetUserBackIn({id, username}))
    },
    [dispatch]
  )
  const onViewProfile = React.useCallback(
    (username: string) => () => {
      Container.isMobile
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    },
    [dispatch]
  )
  const props = {
    onOpenWithoutResetUsers: () =>
      _onOpenWithoutResetUsers(
        path,
        _tlf.resetParticipants.reduce((acc, i: string) => {
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
