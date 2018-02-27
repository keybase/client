// @flow
import Git from '.'
import * as I from 'immutable'
import * as GitGen from '../actions/git-gen'
import * as ChatGen from '../actions/chat-gen'
import * as Types from '../constants/types/git'
import * as Constants from '../constants/git'
import {compose, lifecycle, connect, type TypedState} from '../util/container'
import {createSelector} from 'reselect'
import partition from 'lodash/partition'
import sortBy from 'lodash/sortBy'

const sortRepos = git => sortBy(git, ['teamname', 'name'])
const getInboxBigChannelsToTeam = (state: TypedState) => state.chat.get('inboxBigChannelsToTeam')

const getRepos = createSelector(
  [Constants.getIdToGit, getInboxBigChannelsToTeam],
  (git: ?I.Map<string, Types.GitInfo>, inboxBigChannelsToTeam) => {
    if (!git) {
      return {
        personals: [],
        teams: [],
        bigTeams: [],
      }
    }
    const [personals, teams] = partition(git.valueSeq().toArray(), g => !g.teamname)
    var bigTeamNames = []
    inboxBigChannelsToTeam.forEach((teamname, id) => {
      bigTeamNames.push(teamname)
    })

    return {
      personals: sortRepos(personals).map(g => g.id),
      teams: sortRepos(teams).map(g => g.id),
      bigTeams: teams
        .filter(g => bigTeamNames.includes(g.teamname ? g.teamname.split('.', 1)[0] : ''))
        .map(g => g.id),
    }
  }
)

const mapStateToProps = (state: TypedState, {routeState}) => {
  return {
    ...getRepos(state),
    expandedSet: routeState.get('expandedSet'),
    loading: state.entities.getIn(['git', 'loading']),
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend, setRouteState, routeState, navigateUp}) => ({
  _loadGit: () => dispatch(GitGen.createLoadGit()),
  loadInbox: () => dispatch(ChatGen.createLoadInbox()),
  onBack: () => dispatch(navigateUp()),
  onNewPersonalRepo: () => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(navigateAppend([{props: {isTeam: false}, selected: 'newRepo'}]))
  },
  onNewTeamRepo: () => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(navigateAppend([{props: {isTeam: true}, selected: 'newRepo'}]))
  },
  onShowDelete: (id: string) => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(navigateAppend([{props: {id}, selected: 'deleteRepo'}]))
  },
  onToggleExpand: (id: string) => {
    const old = routeState.get('expandedSet')
    // TODO use unique id
    setRouteState({expandedSet: old.has(id) ? old.delete(id) : old.add(id)})
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props._loadGit()
      this.props.loadInbox()
    },
  })
)(Git)
