// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as SearchGen from '../../actions/search-gen'
import Profile2 from '.'
import {memoize} from '../../util/memoize'
import type {RouteProps} from '../../route-tree/render-route'
import type {Response} from 'react-native-image-picker'
import {PeoplePageSearchBar} from '../../people/index.shared'

type OwnProps = RouteProps<{username: string}, {}>
const emptySet = I.OrderedSet()

const headerBackgroundColorType = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return 'red'
  } else {
    return followThem ? 'green' : 'blue'
  }
}

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.routeProps
    ? ownProps.routeProps.get('username')
    : ownProps.navigation.getParam('username')
  const d = Constants.getDetails(state, username)
  const followThem = Constants.followThem(state, username)
  const userIsYou = username === state.config.username
  const followersCount = state.tracker2.usernameToDetails.getIn([username, 'followersCount'])
  const followingCount = state.tracker2.usernameToDetails.getIn([username, 'followingCount'])

  return {
    _assertions: d.assertions,
    _suggestionKeys: userIsYou ? state.tracker2.proofSuggestions : null,
    backgroundColorType: headerBackgroundColorType(d.state, followThem),
    followThem,
    followers: state.tracker2.usernameToDetails.getIn([username, 'followers']) || emptySet,
    followersCount,
    following: state.tracker2.usernameToDetails.getIn([username, 'following']) || emptySet,
    followingCount,
    guiID: d.guiID,
    reason: d.reason,
    state: d.state,
    userIsYou,
    username,
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({
  _onEditAvatar: (image?: Response) => dispatch(ProfileGen.createEditAvatar()),
  _onReload: (assertion: string, isYou: boolean) => {
    dispatch(
      Tracker2Gen.createLoad({
        assertion,
        guiID: Constants.generateGUIID(),
        ignoreCache: true,
        inTracker: false,
        reason: '',
      })
    )

    if (isYou) {
      dispatch(Tracker2Gen.createGetProofSuggestions())
    }
  },
  onBack: () => dispatch(ownProps.navigateUp()),
  onSearch: () => {
    dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'search'}]}))
  },
})

const followToArray = memoize((followers, following) => ({
  followers: followers.toArray(),
  following: following.toArray(),
}))

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assertionKeys: stateProps._assertions
    ? stateProps._assertions
        .sort((a, b) => a.priority - b.priority)
        .keySeq()
        .toArray()
    : null,
  backgroundColorType: stateProps.backgroundColorType,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  onBack: dispatchProps.onBack,
  onEditAvatar: stateProps.userIsYou ? dispatchProps._onEditAvatar : null,
  onReload: () => dispatchProps._onReload(stateProps.username, stateProps.userIsYou),
  onSearch: dispatchProps.onSearch,
  reason: stateProps.reason,
  state: stateProps.state,
  suggestionKeys: stateProps._suggestionKeys
    ? stateProps._suggestionKeys.map(s => s.assertionKey).toArray()
    : null,
  userIsYou: stateProps.userIsYou,
  username: stateProps.username,
  ...followToArray(stateProps.followers, stateProps.following),
})

const ConnectedHeader = Container.connect<{}, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSearch: () => {
      dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'search'}]}))
    },
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(PeoplePageSearchBar)

const connected = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Profile2'
)(Profile2)

// $FlowIssue lets fix this
connected.navigationOptions = {
  header: undefined,
  headerTitle: hp => <ConnectedHeader />,
  headerTitleContainerStyle: {
    left: 60,
    right: 20,
  },
  headerTransparent: true,
  underNotch: true,
}

export default connected
