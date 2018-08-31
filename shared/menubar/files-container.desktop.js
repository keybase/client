// @flow
import * as FsTypes from '../constants/types/fs'
import * as FsGen from '../actions/fs-gen'
import * as FsUtil from '../util/kbfs'
import * as FsConstants from '../constants/fs'
import * as TimestampUtil from '../util/timestamp'
import {FilesPreview} from './files.desktop'
import {remoteConnect, compose} from '../util/container'

const mapStateToProps = (state) => ({
  _username: state.username,
  _userTlfUpdates: [
    {
      tlf: FsTypes.stringToPath('/keybase/team/zila.test'),
      writer: 'jzila',
      timestamp: 1535497273,
      updates: [
        FsTypes.stringToPath('/keybase/team/zila.test/abc'),
      ],
    },
    {
      tlf: FsTypes.stringToPath('/keybase/team/zila.test'),
      writer: 'songgao',
      timestamp: 1535497273,
      updates: [
        FsTypes.stringToPath('/keybase/team/zila.test/ghi.txt'),
        FsTypes.stringToPath('/keybase/team/zila.test/def'),
        FsTypes.stringToPath('/keybase/team/zila.test/abc'),
      ],
      moreUpdateCount: 17,
    },
  ],
})

const mapDispatchToProps = dispatch => ({
  _onSelectPath: (path: FsTypes.Path) => dispatch(FsGen.createOpenFilesFromWidget({path})),
  onViewAll: () => dispatch(FsGen.createOpenFilesFromWidget({})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onViewAll: dispatchProps.onViewAll,
  userTlfUpdates: stateProps._userTlfUpdates.map(c => {
    const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(FsTypes.pathToString(c.tlf))
    const iconSpec = FsConstants.getIconSpecFromUsernamesAndTeamname([c.writer], null, stateProps._username)
    return {
      onSelectPath: () => dispatchProps._onSelectPath(c.tlf),
      tlf: FsTypes.pathToString(c.tlf),
      // Default to private visibility--this should never happen though.
      tlfType: FsTypes.getPathVisibility(c.tlf) || 'private',
      writer: c.writer,
      participants: participants || [],
      teamname: teamname || '',
      iconSpec,
      timestamp: TimestampUtil.formatTimeForConversationList(c.timestamp),
      updates: c.updates.map(u => ({
        name: FsTypes.getPathName(u),
        onClick: () => dispatchProps._onSelectPath(u),
      })),
    }
  }),
})

export default compose(
  remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(FilesPreview)
