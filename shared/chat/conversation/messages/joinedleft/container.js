// @flow
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as I from 'immutable'
import JoinedLeftNotice from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {navigateAppend, navigateTo} from '../../../../actions/route-tree'
import {isMobile} from '../../../../constants/platform'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {createGetProfile} from '../../../../actions/tracker-gen'
import {chatTab} from '../../../../constants/tabs'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

type StateProps = {
  channelname: string,
  message: Types.TextMessage,
  following: boolean,
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
    Constants.getFollowing,
  ],
  (
    message: Types.JoinedLeftMessage,
    you: string,
    channelname: string,
    teamname: string,
    following: I.Set<Types.Username>
  ) => ({
    channelname,
    following: following.has(message.author),
    message,
    teamname,
    you,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps): * => getDetails(state, messageKey)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onManageChannels: (teamname: string) =>
    isMobile
      ? dispatch(navigateTo([{props: {teamname}, selected: 'manageChannels'}], [chatTab]))
      : dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  onUsernameClicked: (username: string) => {
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({username, ignoreCache: true, forceDisplay: true}))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  ...stateProps,
  onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamname),
  onUsernameClicked: dispatchProps.onUsernameClicked,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(JoinedLeftNotice)
