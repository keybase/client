// @flow
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Route from '../../../actions/route-tree'
import * as TeamTypes from '../../../constants/types/teams'
import * as Types from '../../../constants/types/chat2'
import {InfoPanel} from '.'
import {teamsTab} from '../../../constants/tabs'
import {connect, type TypedState, isMobile} from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {getCanPerform} from '../../../constants/teams'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  // ? because this isn't a route on desktop, and headerHoc is mobile only
  navigateUp?: typeof Route.navigateUp,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey
  const meta = Constants.getMeta(state, conversationIDKey)

  let admin = false
  let canEditChannel = false
  let canSetRetention = false
  if (meta.teamname) {
    const yourOperations = getCanPerform(state, meta.teamname)
    admin = yourOperations.manageMembers
    canEditChannel = yourOperations.editChannelDescription
    canSetRetention = yourOperations.setRetentionPolicy
  }

  return {
    _participants: meta.participants,
    _infoMap: state.users.infoMap,
    admin,
    canEditChannel,
    canSetRetention,
    channelname: meta.channelname,
    description: meta.description,
    isPreview: meta.membershipType === 'youArePreviewing',
    selectedConversationIDKey: conversationIDKey,
    smallTeam: meta.teamType !== 'big',
    teamname: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey, navigateUp}) => ({
  _onAddPeople: (teamname: string, target) =>
    dispatch(
      Route.navigateAppend([
        {
          props: {
            teamname,
            position: 'bottom left',
            targetRect: isMobile ? null : target && target.getBoundingClientRect(),
          },
          selected: 'addPeopleHow',
        },
      ])
    ),
  _onOpenMenu: (teamname: string, isSmallTeam: boolean, target) =>
    dispatch(
      Route.navigateAppend([
        {
          props: {
            teamname,
            isSmallTeam,
            position: 'bottom left',
            targetRect: isMobile ? null : target && target.getBoundingClientRect(),
          },
          selected: 'infoPanelMenu',
        },
      ])
    ),
  _onBack: () => dispatch(navigateUp && navigateUp()),
  _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox()),
  onLeaveConversation: () => dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
  onJoinChannel: () => dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
  onShowBlockConversationDialog: () => {
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showBlockConversationDialog',
        },
      ])
    )
  },
  onShowNewTeamDialog: () => {
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  _onLeaveTeam: (teamname: TeamTypes.Teamname) =>
    dispatch(Route.navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onViewTeam: (teamname: TeamTypes.Teamname) =>
    dispatch(Route.navigateTo([teamsTab, {props: {teamname: teamname}, selected: 'team'}])),
  _onEditChannel: (teamname: string) =>
    dispatch(Route.navigateAppend([{selected: 'editChannel', props: {conversationIDKey, teamname}}])),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

// state props
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  participants: stateProps._participants
    .map(p => ({
      fullname: stateProps._infoMap.getIn([p, 'fullname'], ''),
      username: p,
    }))
    .toArray(),
  onAddPeople: (target: ?Element) => dispatchProps._onAddPeople(stateProps.teamname, target),
  onBack: ownProps.onBack,
  onEditChannel: () => dispatchProps._onEditChannel(stateProps.teamname),
  onJoinChannel: dispatchProps.onJoinChannel,
  onLeaveConversation: dispatchProps.onLeaveConversation,
  onClickGear: (target: ?Element) =>
    dispatchProps._onOpenMenu(stateProps.teamname, stateProps.smallTeam, target),
  onShowBlockConversationDialog: dispatchProps.onShowBlockConversationDialog,
  onShowNewTeamDialog: dispatchProps.onShowNewTeamDialog,
  onShowProfile: dispatchProps.onShowProfile,
  onLeaveTeam: () => dispatchProps._onLeaveTeam(stateProps.teamname),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
})

const ConnectedInfoPanel = connect(mapStateToProps, mapDispatchToProps, mergeProps)(InfoPanel)

type SelectorOwnProps = {
  conversationIDKey: ?Types.ConversationIDKey,
  routeProps?: I.RecordOf<{conversationIDKey: Types.ConversationIDKey}>, // on mobile it's a route
  navigateUp?: typeof Route.navigateUp,
}

const mapStateToSelectorProps = (state: TypedState, ownProps: SelectorOwnProps) => {
  const conversationIDKey =
    ownProps.conversationIDKey || (ownProps.routeProps ? ownProps.routeProps.get('conversationIDKey') : null)
  return {
    conversationIDKey,
  }
}

type SelectorDispatchProps = {
  onBack: () => void,
}

const mapDispatchToSelectorProps = (dispatch: Dispatch, {navigateUp}): SelectorDispatchProps => ({
  // Used by HeaderHoc.
  onBack: () => navigateUp && dispatch(navigateUp()),
})

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  onBack: () => void,
}
class InfoPanelSelector extends React.PureComponent<Props> {
  render() {
    if (!this.props.conversationIDKey) {
      return null
    }

    return <ConnectedInfoPanel onBack={this.props.onBack} conversationIDKey={this.props.conversationIDKey} />
  }
}

export default connect(mapStateToSelectorProps, mapDispatchToSelectorProps)(InfoPanelSelector)
