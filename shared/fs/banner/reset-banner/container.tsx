import * as ProfileGen from '../../../actions/profile-gen'
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

const ConnectedBanner = Container.connect(
  (state, {path}: OwnProps) => ({
    _tlf: Constants.getTlfFromPath(state.fs.tlfs, path),
    _username: state.config.username,
  }),
  dispatch => ({
    _onOpenWithoutResetUsers: (currPath: Types.Path, users: {[K in string]: boolean}) => {
      const pathElems = Types.getPathElements(currPath)
      if (pathElems.length < 3) return
      const filteredPathName = folderNameWithoutUsers(pathElems[2], users)
      const filteredPath = Types.stringToPath(['', pathElems[0], pathElems[1], filteredPathName].join('/'))
      dispatch(Constants.makeActionForOpenPathInFilesTab(filteredPath))
    },
    _onReAddToTeam: (id: RPCTypes.TeamID, username: string) =>
      dispatch(FsGen.createLetResetUserBackIn({id, username})),
    onViewProfile: (username: string) => () =>
      Container.isMobile
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  }),
  (stateProps, {_onReAddToTeam, _onOpenWithoutResetUsers, onViewProfile}, {path}: OwnProps) => {
    return {
      onOpenWithoutResetUsers: () =>
        _onOpenWithoutResetUsers(
          path,
          stateProps._tlf.resetParticipants.reduce((acc, i: string) => {
            acc[i] = true
            return acc
          }, {})
        ),
      onReAddToTeam: (username: string) => () =>
        stateProps._tlf.teamId ? _onReAddToTeam(stateProps._tlf.teamId, username) : undefined,
      onViewProfile,
      path,
      resetParticipants: stateProps._tlf.resetParticipants,
    }
  }
)(Banner)

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
