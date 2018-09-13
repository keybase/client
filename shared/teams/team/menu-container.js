// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {connect, type TypedState} from '../../util/container'
import {navigateTo} from '../../actions/route-tree'
import {type MenuItem} from '../../common-adapters/floating-menu/menu-layout'
import {FloatingMenu} from '../../common-adapters'
import {teamsTab} from '../../constants/tabs'

type OwnProps = {
  attachTo: () => ?React.ElementRef<any>,
  onHidden: () => void,
  teamname: string,
  visible: boolean,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => {
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
      navigateTo(
        [{props: {makeSubteam: true, name: teamname}, selected: 'showNewTeamDialog'}],
        [teamsTab, 'team']
      )
    ),
  onLeaveTeam: () =>
    dispatch(navigateTo([{props: {teamname}, selected: 'reallyLeaveTeam'}], [teamsTab, 'team'])),
  onManageChat: () =>
    dispatch(navigateTo([{props: {teamname}, selected: 'manageChannels'}], [teamsTab, 'team'])),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const items: Array<MenuItem | 'Divider' | null> = []
  if (stateProps.canManageChat) {
    items.push({
      onClick: dispatchProps.onManageChat,
      title: stateProps.isBigTeam ? 'Manage chat channels' : 'Make chat channels...',
      subTitle: stateProps.isBigTeam ? undefined : 'Turns this into a big team',
    })
  }
  if (stateProps.canLeaveTeam) {
    items.push({onClick: dispatchProps.onLeaveTeam, title: 'Leave team', danger: true})
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
  attachTo: () => ?React.ElementRef<any>,
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

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMenu)
