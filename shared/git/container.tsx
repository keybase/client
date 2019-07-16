import * as React from 'react'
import Git, {Props as GitProps} from '.'
import * as I from 'immutable'
import * as GitGen from '../actions/git-gen'
import * as Constants from '../constants/git'
import * as Types from '../constants/types/git'
import * as Kb from '../common-adapters'
import {anyWaiting} from '../constants/waiting'
import * as Container from '../util/container'
import {sortBy, partition} from 'lodash-es'
import {memoize} from '../util/memoize'
import {HeaderTitle, HeaderRightActions} from './nav-header/container'

type OwnProps = Container.RouteProps

const sortRepos = (git: Array<Types.GitInfo>) => sortBy(git, ['teamname', 'name'])

const getRepos = memoize((git: I.Map<string, Types.GitInfo>) => {
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
})

const mapStateToProps = (state: Container.TypedState) => {
  const {personals, teams} = getRepos(Constants.getIdToGit(state))
  return {
    loading: anyWaiting(state, Constants.loadingWaitingKey),
    personals,
    teams,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {navigateAppend, navigateUp}: OwnProps) => ({
  _loadGit: () => dispatch(GitGen.createLoadGit()),
  clearBadges: () => dispatch(GitGen.createClearBadges()),
  onBack: () => dispatch(navigateUp()),
  onNewPersonalRepo: () => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(navigateAppend([{props: {isTeam: false}, selected: 'gitNewRepo'}]))
  },
  onNewTeamRepo: () => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(navigateAppend([{props: {isTeam: true}, selected: 'gitNewRepo'}]))
  },
  onShowDelete: (id: string) => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(navigateAppend([{props: {id}, selected: 'gitDeleteRepo'}]))
  },
})

// keep track in the module
let _expandedSet = I.Set()

/* TODO
  {} & {
    _loadGit: (() => void)
  } & Exclude<
      React.ElementConfig<typeof Git>,
      {
        expandedSet: I.Set<string>
        onToggleExpand: ((arg0: string) => void)
      }
    > */

type ExtraProps = {
  _loadGit: () => void
  clearBadges: () => void
  onBack: () => void
}

class GitReloadable extends React.PureComponent<
  Omit<GitProps & ExtraProps, 'expandedSet' | 'onToggleExpand'>,
  {expandedSet: I.Set<string>}
> {
  state = {expandedSet: _expandedSet}
  _toggleExpand = id => {
    _expandedSet = _expandedSet.has(id) ? _expandedSet.delete(id) : _expandedSet.add(id)
    this.setState({expandedSet: _expandedSet})
  }

  componentWillUnmount() {
    this.props.clearBadges()
  }

  render() {
    const {_loadGit, ...rest} = this.props
    return (
      <Kb.Reloadable
        waitingKeys={Constants.loadingWaitingKey}
        onBack={Container.isMobile ? this.props.onBack : undefined}
        onReload={_loadGit}
        reloadOnMount={true}
      >
        <Git expandedSet={this.state.expandedSet} onToggleExpand={this._toggleExpand} {...rest} />
      </Kb.Reloadable>
    )
  }
}

if (!Container.isMobile) {
  // @ts-ignore lets fix this
  GitReloadable.navigationOptions = {
    header: undefined,
    headerRightActions: HeaderRightActions,
    headerTitle: HeaderTitle,
    title: 'Git',
  }
}

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _ownProps) => ({
    _loadGit: dispatchProps._loadGit,
    clearBadges: dispatchProps.clearBadges,
    loading: stateProps.loading,
    onBack: dispatchProps.onBack,
    onNewPersonalRepo: dispatchProps.onNewPersonalRepo,
    onNewTeamRepo: dispatchProps.onNewTeamRepo,
    onShowDelete: dispatchProps.onShowDelete,
    personals: stateProps.personals,
    teams: stateProps.teams,
  })
)(GitReloadable)
