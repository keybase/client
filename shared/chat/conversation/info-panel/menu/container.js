// @flow
import * as Constants from '../../../../constants/teams'
import * as React from 'react'
import {createGetTeamOperations, createAddTeamWithChosenChannels} from '../../../../actions/teams-gen'
import {namedConnect} from '../../../../util/container'
import {InfoPanelMenu} from '.'
import {navigateAppend, navigateTo, switchTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

export type OwnProps = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  isSmallTeam: boolean,
  teamname: string,
  visible: boolean,
}

// can be expensive, don't run if not visible
const moreThanOneSubscribedChannel = (metaMap, teamname) => {
  let found = 0
  return metaMap.some(c => {
    if (c.teamname === teamname) {
      found++
    }
    // got enough
    if (found === 2) {
      return true
    }
    return false
  })
}

const mapStateToProps = (state, {teamname, isSmallTeam, visible}: OwnProps) => {
  // skip a bunch of stuff for menus that aren't visible
  if (!visible) {
    return {
      badgeSubscribe: false,
      canAddPeople: false,
      hasCanPerform: false,
      isSmallTeam: false,
      manageChannelsSubtitle: '',
      manageChannelsTitle: '',
      memberCount: 0,
      teamname,
    }
  }
  const yourOperations = Constants.getCanPerform(state, teamname)
  // We can get here without loading canPerform
  const hasCanPerform = Constants.hasCanPerform(state, teamname)
  const badgeSubscribe = !Constants.isTeamWithChosenChannels(state, teamname)

  const manageChannelsTitle = isSmallTeam
    ? 'Create chat channels...'
    : moreThanOneSubscribedChannel(state.chat2.metaMap, teamname)
    ? 'Manage chat channels'
    : 'Subscribe to channels...'
  const manageChannelsSubtitle = isSmallTeam ? 'Turns this into a big team' : ''
  return {
    badgeSubscribe,
    canAddPeople: yourOperations.manageMembers,
    hasCanPerform,
    isSmallTeam,
    manageChannelsSubtitle,
    manageChannelsTitle,
    memberCount: Constants.getTeamMemberCount(state, teamname),
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => ({
  loadOperations: () => dispatch(createGetTeamOperations({teamname})),
  onAddPeople: () => {
    dispatch(
      navigateTo(
        [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'addPeople'}],
        [teamsTab]
      )
    )
    dispatch(switchTo([teamsTab]))
  },
  onInvite: () => {
    dispatch(
      navigateTo(
        [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'inviteByEmail'}],
        [teamsTab]
      )
    )
    dispatch(switchTo([teamsTab]))
  },
  onLeaveTeam: () => {
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}]))
  },
  onManageChannels: () => {
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}]))
    dispatch(createAddTeamWithChosenChannels({teamname}))
  },
  onViewTeam: () => {
    dispatch(navigateTo([{props: {teamname}, selected: 'team'}], [teamsTab]))
    dispatch(switchTo([teamsTab]))
  },
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'TeamDropdownMenu'
)(InfoPanelMenu)
