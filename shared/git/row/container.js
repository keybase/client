// @flow
import Row from '.'
import {connect} from 'react-redux'
import {copyToClipboard} from '../../util/clipboard'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {repoID, expanded}) => {
  const git = state.entities.getIn(['git', 'idToInfo', repoID])
  return {
    ...git,
    expanded,
    lastEditUserFollowing: !!state.config.following[git.lastEditUser],
  }
}

const mapDispatchToProps = (dispatch: any, {onToggleExpand, onShowDelete}) => ({
  _onCopy: (url: string) => copyToClipboard(url),
  _onDelete: onShowDelete,
  _onToggleExpand: onToggleExpand,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onCopy: () => dispatchProps._onCopy(stateProps.url),
  onDelete: () => dispatchProps._onDelete(stateProps.repoID),
  onToggleExpand: () => dispatchProps._onToggleExpand(stateProps.repoID),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Row)
