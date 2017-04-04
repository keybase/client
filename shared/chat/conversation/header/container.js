// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import {List} from 'immutable'
import Header from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {onUserClick} from '../../../actions/profile'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  onBack: () => void,
  onToggleSidePanel: () => void,
  sidePanelOpen: boolean,
}

const getUsers = createSelector(
  [Constants.getYou, Constants.getTLF, Constants.getFollowingMap, Constants.getMetaDataMap],
  (you, tlf, followingMap, metaDataMap) => (
    Constants.usernamesToUserListItem(Constants.participantFilter(List(tlf.split(',')), you).toArray(), you, metaDataMap, followingMap)
  )
)

const mapStateToProps = (state: TypedState, {sidePanelOpen}: OwnProps) => ({
  muted: Constants.getMuted(state),
  sidePanelOpen,
  users: getUsers(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleSidePanel}: OwnProps) => ({
  onBack,
  onOpenFolder: () => dispatch(Creators.openFolder()),
  onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
  onToggleSidePanel,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
)(Header)
