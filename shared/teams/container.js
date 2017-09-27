// @flow
import * as I from 'immutable'
import Teams from './main'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'
import {getTeams} from '../actions/teams/creators'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle} from 'recompose'
import {openInKBFS} from '../actions/kbfs'
import {injectItem} from '../actions/gregor'

import type {TypedState} from '../constants/reducer'
import type {Teamname} from '../constants/teams'

type StateProps = {
  _teamnames: I.Set<Teamname>,
  sawChatBanner: boolean,
  loaded: boolean,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const teamnames = state.entities.getIn(['teams', 'teamnames'], I.Set())
  const loaded = state.entities.getIn(['teams', 'loaded'], false)
  return {
    _teamnames: teamnames,
    sawChatBanner: state.entities.getIn(['teams', 'sawChatBanner'], false),
    loaded,
  }
}

type DispatchProps = {
  onCreateTeam: () => void,
  onHideBanner: () => void,
  onJoinTeam: () => void,
  onManageChat: (teamname: Teamname) => void,
  onOpenFolder: (teamname: Teamname) => void,
  onReadMore: () => void,
  onViewTeam: (teamname: Teamname) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _loadTeams: () => dispatch(getTeams()),
  onCreateTeam: () => {
    dispatch(
      navigateAppend([
        {
          props: {},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  onHideBanner: () => dispatch(injectItem('sawChatBanner', 'true')),
  onJoinTeam: () => {
    dispatch(
      navigateAppend([
        {
          props: {},
          selected: 'showJoinTeamDialog',
        },
      ])
    )
    // console.log('onJoinTeam not implemented yet')
  },
  onManageChat: (teamname: Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  onOpenFolder: (teamname: Teamname) => dispatch(openInKBFS(`/keybase/team/${teamname}`)),
  onReadMore: () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  },
  onViewTeam: (teamname: Teamname) => dispatch(navigateAppend([{props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  let teamnames = stateProps._teamnames.toArray()
  // TODO: Sort case-insensitively?
  teamnames.sort()
  return {
    sawChatBanner: stateProps.sawChatBanner,
    teamnames,
    loaded: stateProps.loaded,
    ...dispatchProps,
  }
}

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeams()
    },
  })
)(Teams)
