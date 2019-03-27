// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as SearchGen from '../../actions/search-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Kb from '../../common-adapters'
import Profile2 from '.'
import {memoize} from '../../util/memoize'
import type {RouteProps} from '../../route-tree/render-route'
import type {Response} from 'react-native-image-picker'
import ProfileSearch from '../search/bar'

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
  _onReload: (username: string, isYou: boolean) => {
    dispatch(Tracker2Gen.createShowUser({asTracker: false, username}))

    if (isYou) {
      dispatch(Tracker2Gen.createGetProofSuggestions())
    }
  },
  onAddIdentity: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileProofsList']})),
  onBack: () => dispatch(ownProps.navigateUp()),
  onSearch: () => {
    dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'}))
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
  onAddIdentity: dispatchProps.onAddIdentity,
  onBack: dispatchProps.onBack,
  onEditAvatar: stateProps.userIsYou ? dispatchProps._onEditAvatar : null,
  onReload: () => dispatchProps._onReload(stateProps.username, stateProps.userIsYou),
  onSearch: dispatchProps.onSearch,
  reason: stateProps.reason,
  showOtherIdentities: stateProps.userIsYou, // TODO: gate on available providers
  state: stateProps.state,
  suggestionKeys: stateProps._suggestionKeys
    ? stateProps._suggestionKeys
        .filter(s => !s.belowFold)
        .map(s => s.assertionKey)
        .toArray()
    : null,
  userIsYou: stateProps.userIsYou,
  username: stateProps.username,
  ...followToArray(stateProps.followers, stateProps.following),
})

const connected = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Profile2'
)(Profile2)

const Header = ({onSearch}) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <ProfileSearch onSearch={onSearch} />
  </Kb.Box2>
)
const ConnectedHeader = Container.connect<{||}, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onSearch: () => dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'})),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Header)

// $FlowIssue lets fix this
connected.navigationOptions = {
  header: undefined,
  headerHideBorder: true,
  headerTitle: ConnectedHeader,
  headerTitleContainerStyle: {
    left: 60,
    right: 20,
  },
  headerTransparent: true,
  underNotch: true,
}

export default connected
