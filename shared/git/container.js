// @flow
import Git from '.'
import * as Creators from '../actions/git/creators'
import * as Constants from '../constants/git'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import partition from 'lodash/partition'
import sortBy from 'lodash/sortBy'

import type {TypedState} from '../constants/reducer'

const sortRepos = git => sortBy(git, ['teamname', 'name'])

const getRepos = createSelector([Constants.getIdToGit], git => {
  const [personals, teams] = partition(git.valueSeq().toArray(), g => !g.teamname)

  return {
    personals: sortRepos(personals).map(g => g.id),
    teams: sortRepos(teams).map(g => g.id),
  }
})

const mapStateToProps = (state: TypedState, {routeState}) => {
  return {
    ...getRepos(state),
    expandedSet: routeState.get('expandedSet'),
    loading: state.entities.getIn(['git', 'loading']),
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend, setRouteState, routeState, navigateUp}) => ({
  _loadGit: () => dispatch(Creators.loadGit()),
  onBack: () => dispatch(navigateUp()),
  onNewPersonalRepo: () => {
    dispatch(Creators.setError(null))
    dispatch(navigateAppend([{props: {isTeam: false}, selected: 'newRepo'}]))
  },
  onNewTeamRepo: () => {
    dispatch(Creators.setError(null))
    dispatch(navigateAppend([{props: {isTeam: true}, selected: 'newRepo'}]))
  },
  onShowDelete: (id: string) => {
    dispatch(Creators.setError(null))
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
    },
  })
)(Git)
