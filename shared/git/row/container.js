// @flow
import Row from '.'
import {connect} from 'react-redux'
import {copyToClipboard} from '../../util/clipboard'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {id, expanded}) => {
  const git = state.entities.getIn(['git', 'idToInfo', id]).toObject()
  return {
    ...git,
    expanded,
    lastEditUserFollowing: !!state.config.following[git.lastEditUser],
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  onCopy: () => copyToClipboard(stateProps.url),
  onShowDelete: () => ownProps.onShowDelete(stateProps.id),
  onToggleExpand: () => ownProps.onToggleExpand(stateProps.id),
})

export default connect(mapStateToProps, null, mergeProps)(Row)
