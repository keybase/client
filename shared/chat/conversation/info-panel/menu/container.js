// @flow
import * as Constants from '../../../../constants/teams'
import type {Component} from 'react'
import {createGetTeamOperations, createAddTeamWithChosenChannels} from '../../../../actions/teams-gen'
import {compose, connect, lifecycle, setDisplayName, type TypedState} from '../../../../util/container'
import {InfoPanelMenu} from '.'
import {navigateAppend, navigateTo, switchTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

type OwnProps = {
  attachTo: ?Component<any, any>,
  onHidden: () => void,
  isSmallTeam: boolean,
  teamname: string,
  visible: boolean,
}

const mapStateToProps = (state: TypedState, {teamname, isSmallTeam}: OwnProps) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  // We can get here without loading canPerform
  const _hasCanPerform = Constants.hasCanPerform(state, teamname)
  const badgeSubscribe = !Constants.isTeamWithChosenChannels(state, teamname)
  const numberOfSubscribedChannels = Constants.getNumberOfSubscribedChannels(state, teamname)
  const manageChannelsTitle = isSmallTeam
    ? 'Create chat channels...'
    : numberOfSubscribedChannels > 1
      ? 'Manage chat channels'
      : 'Subscribe to channels...'
  const manageChannelsSubtitle = isSmallTeam ? 'Turns this into a big team' : ''
  return {
    _hasCanPerform,
    badgeSubscribe,
    canAddPeople: yourOperations.manageMembers,
    isSmallTeam,
    manageChannelsSubtitle,
    manageChannelsTitle,
    memberCount: Constants.getTeamMemberCount(state, teamname),
    numberOfSubscribedChannels,
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {teamname}: OwnProps) => ({
  _loadOperations: () => dispatch(createGetTeamOperations({teamname})),
  onAddPeople: () => {
    dispatch(
      navigateTo(
        [{selected: 'team', props: {teamname}}, {selected: 'addPeople', props: {teamname}}],
        [teamsTab]
      )
    )
    dispatch(switchTo([teamsTab]))
  },
  onInvite: () => {
    dispatch(
      navigateTo(
        [{selected: 'team', props: {teamname}}, {selected: 'inviteByEmail', props: {teamname}}],
        [teamsTab]
      )
    )
    dispatch(switchTo([teamsTab]))
  },
  onLeaveTeam: () => {
    dispatch(navigateAppend([{selected: 'reallyLeaveTeam', props: {teamname}}]))
  },
  onManageChannels: () => {
    dispatch(navigateAppend([{selected: 'manageChannels', props: {teamname}}]))
    dispatch(createAddTeamWithChosenChannels({teamname}))
  },
  onViewTeam: () => {
    dispatch(navigateTo([{selected: 'team', props: {teamname}}], [teamsTab]))
    dispatch(switchTo([teamsTab]))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  setDisplayName('TeamDropdownMenu'),
  lifecycle({
    componentDidMount() {
      if (!this.props._hasCanPerform) {
        this.props._loadOperations()
      }
    },
  })
)(InfoPanelMenu)
