// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {connect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {type MenuItem} from '../../common-adapters/floating-menu/menu-layout'
import {FloatingMenu} from '../../common-adapters'
import {teamsTab} from '../../constants/tabs'

type OwnProps = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  teamname: string,
  visible: boolean,
}

const mapStateToProps = (state, {teamname}: OwnProps) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  const isBigTeam = Constants.isBigTeam(state, teamname)
  return {
    canCreateSubteam: yourOperations.manageSubteams,
    canLeaveTeam: yourOperations.leaveTeam,
    canManageChat: yourOperations.renameChannel,
    isBigTeam,
  }
}

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => ({
  onCreateSubteam: () =>
    dispatch(
      RouteTreeGen.createNavigateTo({
        parentPath: [teamsTab, 'team'],
        path: [{props: {makeSubteam: true, name: teamname}, selected: 'showNewTeamDialog'}],
      })
    ),
  onLeaveTeam: () =>
    dispatch(
      RouteTreeGen.createNavigateTo({
        parentPath: [teamsTab, 'team'],
        path: [{props: {teamname}, selected: 'reallyLeaveTeam'}],
      })
    ),
  onManageChat: () =>
    dispatch(
      RouteTreeGen.createNavigateTo({
        parentPath: [teamsTab, 'team'],
        path: [{props: {teamname}, selected: 'manageChannels'}],
      })
    ),
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
  return {
    attachTo: ownProps.attachTo,
    items,
    onHidden: ownProps.onHidden,
    visible: ownProps.visible,
  }
}

type Props = {
  attachTo: () => ?React.Component<any>,
  items: Array<MenuItem | 'Divider' | null>,
  onHidden: () => void,
  visible: boolean,
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

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TeamMenu)
