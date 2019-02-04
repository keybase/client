// @flow
import * as React from 'react'
import Git from '.'
import * as I from 'immutable'
import * as GitGen from '../actions/git-gen'
import * as Constants from '../constants/git'
import * as Kb from '../common-adapters'
import {anyWaiting} from '../constants/waiting'
import {compose, connect, isMobile, type RouteProps} from '../util/container'
import {sortBy, partition} from 'lodash-es'

type OwnProps = RouteProps<{}, {expandedSet: I.Set<string>}>

const sortRepos = git => sortBy(git, ['teamname', 'name'])

const getRepos = state => {
  const git = Constants.getIdToGit(state)
  if (!git) {
    return {
      personals: [],
      teams: [],
    }
  }
  const [personals, teams] = partition(git.valueSeq().toArray(), g => !g.teamname)

  return {
    personals: sortRepos(personals).map(g => g.id),
    teams: sortRepos(teams).map(g => g.id),
  }
}

const mapStateToProps = (state, {routeState}) => {
  return {
    ...getRepos(state),
    expandedSet: routeState.get('expandedSet'),
    loading: anyWaiting(state, Constants.loadingWaitingKey),
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend, setRouteState, routeState, navigateUp}) => ({
  _loadGit: () => dispatch(GitGen.createLoadGit()),
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

class GitReloadable extends React.PureComponent<{
  ...{|_loadGit: () => void|},
  ...React.ElementConfig<typeof Git>,
}> {
  render() {
    return (
      <Kb.Reloadable
        waitingKeys={Constants.loadingWaitingKey}
        onBack={isMobile ? this.props.onBack : undefined}
        onReload={this.props._loadGit}
        reloadOnMount={true}
      >
        <Git
          expandedSet={this.props.expandedSet}
          loading={this.props.loading}
          onShowDelete={this.props.onShowDelete}
          onNewPersonalRepo={this.props.onNewPersonalRepo}
          onNewTeamRepo={this.props.onNewTeamRepo}
          onToggleExpand={this.props.onToggleExpand}
          personals={this.props.personals}
          teams={this.props.teams}
          onBack={this.props.onBack}
        />
      </Kb.Reloadable>
    )
  }
}

const mergeProps = (s, d, o) => ({
  _loadGit: d._loadGit,
  expandedSet: s.expandedSet,
  loading: s.loading,
  onBack: d.onBack,
  onNewPersonalRepo: d.onNewPersonalRepo,
  onNewTeamRepo: d.onNewTeamRepo,
  onShowDelete: d.onShowDelete,
  onToggleExpand: d.onToggleExpand,
  personals: s.personals,
  teams: s.teams,
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(GitReloadable)
