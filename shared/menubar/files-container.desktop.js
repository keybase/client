// @flow
import * as React from 'react'
import * as FsTypes from '../constants/types/fs'
import * as FsGen from '../actions/fs-gen'
import * as FsUtil from '../util/kbfs'
import * as FsConstants from '../constants/fs'
import * as TimestampUtil from '../util/timestamp'
import {FilesPreview, type UserTlfUpdateRowProps} from './files.desktop'
import {remoteConnect, compose} from '../util/container'

const mapStateToProps = (state) => ({
  _username: state.username,
  _userTlfUpdates: state.fileRows,
})

const mapDispatchToProps = dispatch => ({
  _onSelectPath: (path: FsTypes.Path) => dispatch(FsGen.createOpenFilesFromWidget({path})),
  loadTlfUpdates: () => dispatch(FsGen.createUserFileEditsLoad()),
  onViewAll: () => dispatch(FsGen.createOpenFilesFromWidget({})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onViewAll: dispatchProps.onViewAll,
  loadTlfUpdates: dispatchProps.loadTlfUpdates,
  // TODO: fix this slice once the UI is fixed.
  userTlfUpdates: stateProps._userTlfUpdates.slice(0, 2).map(c => {
    console.log(c.tlf)
    const tlf = FsTypes.pathToString(c.tlf)
    const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(tlf)
    const iconSpec = FsConstants.getIconSpecFromUsernamesAndTeamname([c.writer], null, stateProps._username)
    return {
      onSelectPath: () => dispatchProps._onSelectPath(c.tlf),
      tlf,
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

type TlfUpdateHocProps = {|
  loadTlfUpdates: () => void,
  onViewAll: () => void,
  userTlfUpdates: Array<UserTlfUpdateRowProps>,
|}

const TlfUpdateHoc = (ComposedComponent: React.ComponentType<any>) =>
  class extends React.PureComponent<TlfUpdateHocProps> {
    componentDidMount() {
      this.props.loadTlfUpdates()
    }
    render() {
      return <ComposedComponent {...this.props} />
    }
  }

export default compose(
  remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  TlfUpdateHoc,
)(FilesPreview)
