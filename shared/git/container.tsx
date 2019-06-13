import * as React from 'react'
import Git, {Props as GitProps} from '.'
import * as I from 'immutable'
import * as GitGen from '../actions/git-gen'
import * as Constants from '../constants/git'
import {TypedState} from '../constants/reducer'
import * as Kb from '../common-adapters'
import {anyWaiting} from '../constants/waiting'
import {compose, connect, isMobile, RouteProps} from '../util/container'
import {sortBy, partition} from 'lodash-es'
import {memoize} from '../util/memoize'
import {HeaderTitle, HeaderRightActions} from './nav-header/container'

type OwnProps = RouteProps<{}, {}>

const sortRepos = git => sortBy(git, ['teamname', 'name'])

const getRepos = memoize(git => {
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

const mapStateToProps = (state: TypedState) => {
  const {personals, teams} = getRepos(Constants.getIdToGit(state))
  return {
    loading: anyWaiting(state, Constants.loadingWaitingKey),
    personals,
    teams,
  }
}

const mapDispatchToProps = (dispatch: (action: any) => void, {navigateAppend, navigateUp}: OwnProps) => ({
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

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  _ownProps
) => ({
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

class GitReloadable extends React.PureComponent<GitProps & ExtraProps, {expandedSet: I.Set<string>}> {
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
        onBack={isMobile ? this.props.onBack : undefined}
        onReload={_loadGit}
        reloadOnMount={true}
      >
        <Git expandedSet={this.state.expandedSet} onToggleExpand={this._toggleExpand} {...rest} />
      </Kb.Reloadable>
    )
  }
}

if (!isMobile) {
  // @ts-ignore lets fix this
  GitReloadable.navigationOptions = {
    header: undefined,
    headerRightActions: HeaderRightActions,
    headerTitle: HeaderTitle,
    title: 'Git',
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(GitReloadable)
