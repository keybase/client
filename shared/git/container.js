// @flow
import Git from '.'
import * as Constants from '../constants/git'
import * as Creators from '../actions/git/creators'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {copyToClipboard} from '../util/clipboard'
import partition from 'lodash/partition'

import type {TypedState} from '../constants/reducer'

const getIdToGit = (state: TypedState) => state.entities.getIn(['git', 'idToInfo'])
const getFollowing = (state: TypedState) => state.config.following

const mergeFollowIntoGit = (git: Constants.GitInfoRecord, following: {[key: string]: true}) => ({
  // $FlowIssue
  ...git.toJS(),
  lastEditUserFollowing: !!following[git.lastEditUser],
})

// sort by teamname then name
const sortRepos = (a: Constants.GitInfoRecord, b: Constants.GitInfoRecord) => {
  if (a.teamname) {
    if (b.teamname) {
      if (a.teamname === b.teamname) {
        return a.name.localeCompare(b.name)
      } else {
        return a.teamname.localeCompare(b.teamname)
      }
    }
    return -1
  }

  if (b.teamname) {
    return 1
  }

  return a.name.localeCompare(b.name)
}

const getRepos = createSelector([getIdToGit, getFollowing], (git, following) => {
  const [personals, teams] = partition(
    git.valueSeq().map(g => mergeFollowIntoGit(g, following)).toArray().sort(sortRepos),
    g => !g.teamname
  )

  return {
    personals,
    teams,
  }
})

const mapStateToProps = (state: TypedState) => {
  return {
    ...getRepos(state),
    loading: state.entities.getIn(['git', 'loading']),
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend}) => ({
  _loadGit: () => dispatch(Creators.loadGit()),
  onCopy: (url: string) => copyToClipboard(url),
  onDelete: (teamname: ?string, name: string) =>
    dispatch(navigateAppend([{props: {name, teamname}, selected: 'deleteRepo'}])),
  onNewPersonalRepo: () => dispatch(navigateAppend([{props: {isTeam: false}, selected: 'newRepo'}])),
  onNewTeamRepo: () => dispatch(navigateAppend([{props: {isTeam: true}, selected: 'newRepo'}])),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props._loadGit()
    },
  })
)(Git)
