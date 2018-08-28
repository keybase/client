// @flow
import * as FsTypes from '../constants/types/fs'
import * as FsGen from '../actions/fs-gen'
import * as FsUtil from '../util/kbfs'
import * as FsConstants from '../constants/fs'
import {FilesPreview} from './files.desktop'
import {remoteConnect, compose} from '../util/container'

const mapStateToProps = (state) => ({
  _username: state.username,
  _tlfRows: [
    {
      path: FsTypes.stringToPath('/keybase/team/zila.test/abc'),
      writer: 'jzila',
    },
    {
      path: FsTypes.stringToPath('/keybase/team/zila.test/def'),
      writer: 'songgao',
    },
  ],
})

const mapDispatchToProps = dispatch => ({
  _onSelectPath: (path: FsTypes.Path) => dispatch(FsGen.createOpenFilesFromWidget({path})),
  onViewAll: () => dispatch(FsGen.createOpenFilesFromWidget({})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onViewAll: dispatchProps.onViewAll,
  tlfRows: stateProps._tlfRows.map(c => {
    const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(FsTypes.pathToString(c.path))
    const iconSpec = FsConstants.getIconSpecFromUsernamesAndTeamname([c.writer], null, stateProps._username)
    return {
      onSelectPath: () => dispatchProps._onSelectPath(c.path),
      path: FsTypes.pathToString(c.path),
      // Default to private visibility--this should never happen though.
      tlfType: FsTypes.getPathVisibility(c.path) || 'private',
      writer: c.writer,
      participants: participants || [],
      teamname: teamname || '',
      iconSpec,
    }
  }),
})

export default compose(
  remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(FilesPreview)
