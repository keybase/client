// @flow
import * as Actions from '../actions/profile'
import * as TrackerActions from '../actions/tracker'
import ErrorComponent from '../common-adapters/error-profile'
import Profile from './index'
import {compose, branch, renderComponent} from 'recompose'
import {connect} from 'react-redux'
import {isLoading} from '../constants/tracker'
import {isTesting} from '../local-debug'
import {navigateAppend} from '../actions/route-tree'
import {openInKBFS} from '../actions/kbfs'
import {profileTab} from '../constants/tabs'
import {startConversation} from '../actions/chat'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/tracker'
import type {RouteProps} from '../route-tree/render-route'
import type {Tab as FriendshipsTab} from './friendships'

type OwnProps = {
  navigateUp: () => void,
  routeProps: {
    username: ?string,
  },
} & RouteProps<{}, {currentFriendshipsTab: FriendshipsTab}>

type OwnPropsPlusUsername = {
  username: string,
  myName: string,
} & OwnProps

const mapStateToProps = (
  state,
  {routeProps, routeState, routePath, username, myName}: OwnPropsPlusUsername
) => {
  return {
    currentFriendshipsTab: routeState.currentFriendshipsTab,
    myName,
    profileIsRoot: routePath.size === 1 && routePath.first() === profileTab,
    trackerState: state.tracker.trackers[username],
    username,
  }
}

const mapDispatchToProps = (
  dispatch: any,
  {routeProps, setRouteState, navigateUp, username, myName}: OwnPropsPlusUsername
) => {
  const onEditProfile = () => {
    dispatch(navigateAppend(['editProfile']))
  }
  return {
    getProfile: () => dispatch(TrackerActions.getProfile(username)),
    onAcceptProofs: () => {
      dispatch(TrackerActions.onFollow(username, false))
    },
    onBack: () => {
      dispatch(navigateUp())
    },
    onChangeFriendshipsTab: currentFriendshipsTab => {
      setRouteState({currentFriendshipsTab})
    },
    onChat: () => {
      dispatch(startConversation([username, myName]))
    },
    onClickAvatar: () => {
      dispatch(Actions.onClickAvatar(username))
    },
    onClickFollowers: () => {
      dispatch(Actions.onClickFollowers(username))
    },
    onClickFollowing: () => {
      dispatch(Actions.onClickFollowing(username))
    },
    onEditAvatar: () => {
      dispatch(navigateAppend(['editAvatar']))
    },
    onEditProfile,
    onBioEdit: onEditProfile,
    onLocationEdit: onEditProfile,
    onNameEdit: onEditProfile,
    onFolderClick: folder => {
      dispatch(openInKBFS(folder.path))
    },
    onFollow: () => {
      dispatch(TrackerActions.onFollow(username, false))
    },
    onMissingProofClick: (missingProof: MissingProof) => {
      dispatch(Actions.addProof(missingProof.type))
    },
    onRecheckProof: (proof: Proof) => {
      dispatch(Actions.checkProof(proof && proof.id))
    },
    onRevokeProof: (proof: Proof) => {
      dispatch(
        navigateAppend(
          [
            {
              props: {platform: proof.type, platformHandle: proof.name, proofId: proof.id},
              selected: 'revoke',
            },
          ],
          [profileTab]
        )
      )
    },
    onUnfollow: () => {
      dispatch(TrackerActions.onUnfollow(username))
    },
    onUserClick: username => {
      dispatch(Actions.onUserClick(username))
    },
    onViewProof: (proof: Proof) => {
      dispatch(TrackerActions.openProofUrl(proof))
    },
    refresh: () => {
      dispatch(TrackerActions.getProfile(username))
      dispatch(TrackerActions.updateTrackers(username))
    },
    updateTrackers: () => dispatch(TrackerActions.updateTrackers(username)),
  }
}

const mergeProps = (stateProps, dispatchProps) => {
  const onBack = stateProps.profileIsRoot ? null : dispatchProps.onBack

  if (stateProps.trackerState && stateProps.trackerState.type !== 'tracker') {
    const error = 'Expected a tracker type, trying to show profile for non user'
    console.warn(error)
    return {
      error,
      onBack,
    }
  }

  const {username} = stateProps

  return {
    ...stateProps.trackerState,
    ...dispatchProps,
    currentFriendshipsTab: stateProps.currentFriendshipsTab,
    followers: (stateProps.trackerState && stateProps.trackerState.trackers) || [],
    following: (stateProps.trackerState && stateProps.trackerState.tracking) || [],
    isYou: username === stateProps.myName,
    loading: isLoading(stateProps.trackerState) && !isTesting,
    onBack,
    proofs: (stateProps.trackerState && stateProps.trackerState.proofs) || [],
    username,
  }
}

const mapStateToUsernameProps = (state, ownProps: OwnProps) => ({
  ...ownProps,
  myName: state.config.username,
  username: ownProps.routeProps.username ? ownProps.routeProps.username : state.config.username,
})

export default compose(
  connect(mapStateToUsernameProps),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => !!props.error, renderComponent(ErrorComponent))
)(Profile)
