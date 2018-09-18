// @flow
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import Team from '.'
import CustomTitle from './custom-title/container'
import {HeaderHoc} from '../../common-adapters'
import {connect, lifecycle, compose, type TypedState} from '../../util/container'
import {mapStateHelper as invitesMapStateHelper, getRows as getInviteRows} from './invites-tab/helper'
import {mapStateHelper as memberMapStateHelper, getRows as getMemberRows} from './members-tab/helper'
import {mapStateHelper as subteamsMapStateHelper, getRows as getSubteamsRows} from './subteams-tab/helper'
import type {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{teamname: string}, {selectedTab: ?string}>

const mapStateToProps = (state: TypedState, {routeProps, routeState}: OwnProps) => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }
  const selectedTab = routeState.get('selectedTab') || 'members'

  return {
    ...(selectedTab === 'members' ? memberMapStateHelper(state, {teamname}) : {}),
    ...(selectedTab === 'invites' ? invitesMapStateHelper(state, {teamname}) : {}),
    ...(selectedTab === 'subteams' ? subteamsMapStateHelper(state, {teamname}) : {}),
    selectedTab,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, setRouteState, routeProps}: OwnProps) => {
  return {
    _loadTeam: (teamname: string) => dispatch(TeamsGen.createGetDetails({teamname})),
    onBack: () => dispatch(navigateUp()),
    setSelectedTab: (selectedTab: string) => setRouteState({selectedTab}),
  }
}

const mergeProps = (stateProps, dispatchProps) => {
  let tabSpecificRows = []
  switch (stateProps.selectedTab) {
    case 'members':
      tabSpecificRows = getMemberRows(stateProps)
      break
    case 'invites':
      tabSpecificRows = getInviteRows(stateProps)
      break
    case 'subteams':
      tabSpecificRows = getSubteamsRows(stateProps)
      break
    case 'settings':
      tabSpecificRows = [{type: 'settings'}]
      break
  }
  const rows = [{type: 'header'}, {type: 'tabs'}, ...tabSpecificRows]
  const customComponent = <CustomTitle teamname={stateProps.teamname} />
  return {
    _loadTeam: dispatchProps._loadTeam,
    customComponent,
    onBack: dispatchProps.onBack,
    rows,
    selectedTab: stateProps.selectedTab,
    setSelectedTab: dispatchProps.setSelectedTab,
    teamname: stateProps.teamname,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props._loadTeam(this.props.teamname)
    },
    componentDidUpdate(prevProps) {
      if (this.props.teamname !== prevProps.teamname) {
        this.props._loadTeam(this.props.teamname)
        this.props.setSelectedTab('members')
      }
    },
  }),
  HeaderHoc
)(Team)
