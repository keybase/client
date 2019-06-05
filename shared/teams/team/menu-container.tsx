import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import {connect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {MenuItem} from '../../common-adapters/floating-menu/menu-layout'
import {FloatingMenu} from '../../common-adapters'

type OwnProps = {
  attachTo: (() => React.Component<any>) | null
  onHidden: () => void
  teamname: string
  visible: boolean
}

const mapStateToProps = (state, {teamname}: OwnProps) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  const isBigTeam = Constants.isBigTeam(state, teamname)
  return {
    canCreateSubteam: yourOperations.manageSubteams,
    canDeleteTeam: yourOperations.deleteTeam && Constants.getTeamSubteams(state, teamname).count() === 0,
    canLeaveTeam: yourOperations.leaveTeam,
    canManageChat: yourOperations.renameChannel,
    canViewFolder: !yourOperations.joinTeam,
    isBigTeam,
  }
}

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => ({
  onCreateSubteam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {makeSubteam: true, name: teamname}, selected: 'teamNewTeamDialog'}],
      })
    ),
  onDeleteTeam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamname}, selected: 'teamDeleteTeam'}],
      })
    ),
  onLeaveTeam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamname}, selected: 'teamReallyLeaveTeam'}],
      })
    ),
  onManageChat: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamname}, selected: 'chatManageChannels'}],
      })
    ),
  onOpenFolder: () =>
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const items: Array<MenuItem | 'Divider' | null> = []
  if (stateProps.canManageChat) {
    items.push({
      onClick: dispatchProps.onManageChat,
      subTitle: stateProps.isBigTeam ? undefined : 'Turns this into a big team',
      title: stateProps.isBigTeam ? 'Manage chat channels' : 'Make chat channels...',
    })
  }
  if (stateProps.canLeaveTeam) {
    items.push({danger: true, onClick: dispatchProps.onLeaveTeam, title: 'Leave team'})
  }
  if (stateProps.canCreateSubteam) {
    items.push({onClick: dispatchProps.onCreateSubteam, title: 'Create subteam'})
  }
  if (stateProps.canViewFolder) {
    items.push({onClick: dispatchProps.onOpenFolder, title: 'Open folder'})
  }
  if (stateProps.canDeleteTeam) {
    items.push({danger: true, onClick: dispatchProps.onDeleteTeam, title: 'Delete team'})
  }

  return {
    attachTo: ownProps.attachTo,
    items,
    onHidden: ownProps.onHidden,
    visible: ownProps.visible,
  }
}

type Props = {
  attachTo: () => React.Component<any> | null
  items: Array<MenuItem | 'Divider' | null>
  onHidden: () => void
  visible: boolean
}

const TeamMenu = ({attachTo, items, onHidden, visible}: Props) => {
  if (visible && items.length === 0) {
    onHidden()
    return null
  }
  return (
    <FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={items}
      onHidden={onHidden}
      visible={visible}
    />
  )
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TeamMenu)
