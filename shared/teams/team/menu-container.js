// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {connect, type TypedState} from '../../util/container'
import {navigateTo, navigateUp} from '../../actions/route-tree'
import PopupMenu, {ModalLessPopupMenu, type MenuItem} from '../../common-adapters/popup-menu'
import {globalMargins, isMobile} from '../../styles'
import {teamsTab} from '../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canCreateSubteam: yourOperations.manageSubteams,
    canLeaveTeam: yourOperations.leaveTeam,
    canManageChat: yourOperations.renameChannel,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    onCreateSubteam: () =>
      dispatch(
        navigateTo(
          [{props: {makeSubteam: true, name: teamname}, selected: 'showNewTeamDialog'}],
          [teamsTab, 'team']
        )
      ),
    onHidden: () => dispatch(navigateUp()),
    onLeaveTeam: () =>
      dispatch(navigateTo([{props: {teamname}, selected: 'reallyLeaveTeam'}], [teamsTab, 'team'])),
    onManageChat: () =>
      dispatch(navigateTo([{props: {teamname}, selected: 'manageChannels'}], [teamsTab, 'team'])),
  }
}

const mergeProps = (stateProps, dispatchProps) => {
  const items = []
  if (stateProps.canManageChat) {
    items.push({onClick: dispatchProps.onManageChat, title: 'Manage chat channels'})
  }
  if (stateProps.canLeaveTeam) {
    items.push({onClick: dispatchProps.onLeaveTeam, title: 'Leave team', danger: true})
  }
  if (stateProps.canCreateSubteam) {
    items.push({onClick: dispatchProps.onCreateSubteam, title: 'Create subteam'})
  }
  return {
    items,
    onHidden: dispatchProps.onHidden,
  }
}

const TeamMenu = ({items, onHidden}: {items: MenuItem[], onHidden: () => void}) => {
  if (items.length === 0) {
    onHidden()
    return null
  }
  return isMobile ? (
    <PopupMenu
      onHidden={onHidden}
      style={isMobile ? {overflow: 'visible'} : {position: 'absolute', right: globalMargins.tiny, top: 36}}
      // $FlowIssue items is compatible
      items={items}
    />
  ) : (
    <ModalLessPopupMenu
      onHidden={() => {}}
      style={{overflow: 'visible'}}
      // $FlowIssue items is compatible
      items={items}
    />
  )
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMenu)
