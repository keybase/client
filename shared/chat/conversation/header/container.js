// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import {List} from 'immutable'
import Header from '.'
import {connect} from 'react-redux-profiled'
import {createSelector} from 'reselect'
import {onUserClick} from '../../../actions/profile'
import {chatTab} from '../../../constants/tabs'

import type {TypedState} from '../../../constants/reducer'
import type {OwnProps} from './container'

const getUsers = createSelector(
  [Constants.getYou, Constants.getTLF, Constants.getFollowingMap, Constants.getMetaDataMap],
  (you, tlf, followingMap, metaDataMap) =>
    Constants.usernamesToUserListItem(
      Constants.participantFilter(List(tlf.split(',')), you).toArray(),
      you,
      metaDataMap,
      followingMap
    )
)

const mapStateToProps = (state: TypedState, {infoPanelOpen}: OwnProps) => ({
  badgeNumber: state.notifications.get('navBadges').get(chatTab),
  muted: Constants.getMuted(state),
  infoPanelOpen,
  users: getUsers(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleInfoPanel}: OwnProps) => ({
  onBack,
  onOpenFolder: () => dispatch(Creators.openFolder()),
  onShowProfile: (username: string) => dispatch(onUserClick(username)),
  onToggleInfoPanel,
})

export default connect(mapStateToProps, mapDispatchToProps)(Header)
