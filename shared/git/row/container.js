// @flow
import Row from '.'
import {connect} from 'react-redux'
import {copyToClipboard} from '../../util/clipboard'
import {usernameSelector} from '../../constants/selectors'
import openURL from '../../util/open-url'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {id, expanded}) => {
  const git = state.entities.getIn(['git', 'idToInfo', id]).toObject()
  return {
    ...git,
    expanded,
    isNew: state.entities.getIn(['git', 'isNew', id], false),
    lastEditUserFollowing: !!state.config.following[git.lastEditUser],
    you: usernameSelector(state),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  onClickDevice: () =>
    stateProps.lastEditUser && openURL(`https://keybase.io/${stateProps.lastEditUser}/devices`),
  onCopy: () => copyToClipboard(stateProps.url),
  onShowDelete: () => ownProps.onShowDelete(stateProps.id),
  onToggleExpand: () => ownProps.onToggleExpand(stateProps.id),
})

export default connect(mapStateToProps, null, mergeProps)(Row)
