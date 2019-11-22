import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Kb from '../../common-adapters'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  teamID: Types.TeamID
  visible: boolean
}

const mapStateToProps = (state: Container.TypedState, {teamID}: OwnProps) => {
  const teamDetails = Constants.getTeamDetails(state, teamID)
  const yourOperations = Constants.getCanPerformByID(state, teamID)
  const isBigTeam = Constants.isBigTeam(state, teamID)
  return {
    canCreateSubteam: yourOperations.manageSubteams,
    canDeleteTeam: yourOperations.deleteTeam && teamDetails.subteams?.size === 0,
    canManageChat: yourOperations.renameChannel,
    canViewFolder: !yourOperations.joinTeam,
    isBigTeam,
    teamname: teamDetails.teamname,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {teamID}: OwnProps) => ({
  onCreateSubteam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {subteamOf: teamID}, selected: 'teamNewTeamDialog'}],
      })
    ),
  onDeleteTeam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID}, selected: 'teamDeleteTeam'}],
      })
    ),
  onLeaveTeam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID}, selected: 'teamReallyLeaveTeam'}],
      })
    ),
  onManageChat: (teamname: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamname}, selected: 'chatManageChannels'}],
      })
    ),
  onOpenFolder: (teamname: string) =>
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))),
})

type Props = {
  attachTo?: () => React.Component<any> | null
  items: Kb.MenuItems
  onHidden: () => void
  visible: boolean
}

const TeamMenu = ({attachTo, items, onHidden, visible}: Props) => {
  if (visible && items.length === 0) {
    onHidden()
    return null
  }
  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={items}
      onHidden={onHidden}
      visible={visible}
    />
  )
}

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const items: Kb.MenuItems = []
    if (stateProps.canManageChat) {
      items.push({
        onClick: () => dispatchProps.onManageChat(stateProps.teamname),
        subTitle: stateProps.isBigTeam ? undefined : 'Turns this into a big team',
        title: stateProps.isBigTeam ? 'Manage chat channels' : 'Make chat channels...',
      })
    }
    if (stateProps.canCreateSubteam) {
      items.push({onClick: dispatchProps.onCreateSubteam, title: 'Create subteam'})
    }
    if (stateProps.canViewFolder) {
      items.push({onClick: () => dispatchProps.onOpenFolder(stateProps.teamname), title: 'Open folder'})
    }
    items.push({danger: true, onClick: dispatchProps.onLeaveTeam, title: 'Leave team'})
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
)(TeamMenu) as any
