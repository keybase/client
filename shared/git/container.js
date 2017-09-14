// @flow
import Git from '.'
import * as I from 'immutable'
import * as Constants from '../constants/git'
import * as Creators from '../actions/git/creators'
import {compose, lifecycle, mapProps, withState, withHandlers} from 'recompose'
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

const getRepos = createSelector([getIdToGit, getFollowing], (git, following) => {
  const [personals, teams] = partition(
    git.valueSeq().map(g => mergeFollowIntoGit(g, following)).toArray(),
    g => !g.teamname
  )

  return {
    personals,
    teams,
  }
})

const mapStateToProps = (state: TypedState) => {
  return getRepos(state)
}

const mapDispatchToProps = (dispatch: any) => ({
  _loadGit: () => dispatch(Creators.loadGit()),
  onCopy: (url: string) => copyToClipboard(url),
  onDelete: (url: string) => console.warn('TODO'),
  onNewPersonalRepo: () => console.warn('TODO'),
  onNewTeamRepo: () => console.warn('TODO'),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props._loadGit()
    },
  })
)(Git)
