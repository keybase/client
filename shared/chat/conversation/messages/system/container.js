// @flow
import * as Constants from '../../../../constants/chat'
import SystemNotice from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {navigateTo, switchTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import {isMobile} from '../../../../constants/platform'
import {showUserProfile} from '../../../../actions/profile'
import {getProfile} from '../../../../actions/tracker'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

type StateProps = {
  channelname: string,
  message: Constants.TextMessage,
  teamname: string,
  you: string,
}

type DispatchProps = {
  _onManageChannels: (teamname: string) => void,
  onUsernameClicked: (username: string) => void,
}

const getDetails = createCachedSelector(
  [
    Constants.getMessageFromMessageKey,
    Constants.getYou,
    Constants.getChannelName,
    Constants.getTeamName,
    Constants.getFollowingMap,
  ],
  (
    message: Constants.TextMessage,
    you: string,
    channelname: string,
    teamname: string,
    following: {[key: string]: ?boolean}
  ) => ({
    channelname,
    following: !!following[message.author],
    message,
    teamname,
    you,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => getDetails(state, messageKey)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onManageChannels: (teamname: string) => {
    dispatch(navigateTo([{props: {teamname}, selected: 'manageChannels'}], [teamsTab]))
    dispatch(switchTo([teamsTab]))
  },
  onUsernameClicked: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  ...stateProps,
  onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamname),
  onUsernameClicked: dispatchProps.onUsernameClicked,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(SystemNotice)
