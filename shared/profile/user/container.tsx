import * as React from 'react'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as SearchGen from '../../actions/search-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Profile2 from '.'
import {memoize} from '../../util/memoize'
import {RouteProps} from '../../route-tree/render-route'
// @ts-ignore codemode issue
import {Response} from 'react-native-image-picker'
import ProfileSearch from '../search/bar'
import flags from '../../util/feature-flags'

type OwnProps = RouteProps<
  {
    username: string
  },
  {}
>

const headerBackgroundColorType = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return 'red'
  } else if (state === 'notAUserYet') {
    return 'blue'
  } else {
    return followThem ? 'green' : 'blue'
  }
}

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.routeProps
    ? ownProps.routeProps.get('username')
    : ownProps.navigation.getParam('username')
  const d = Constants.getDetails(state, username)
  const notAUser = d.state === 'notAUserYet'
  const followThem = notAUser ? false : Constants.followThem(state, username)
  const userIsYou = username === state.config.username
  const followersCount =
    (!notAUser && state.tracker2.usernameToDetails.getIn([username, 'followersCount'])) || 0
  const followingCount =
    (!notAUser && state.tracker2.usernameToDetails.getIn([username, 'followingCount'])) || 0

  return {
    _assertions: d.assertions,
    _suggestionKeys: userIsYou ? state.tracker2.proofSuggestions : null,
    backgroundColorType: headerBackgroundColorType(d.state, followThem),
    followThem,
    followers: state.tracker2.usernameToDetails.getIn([username, 'followers']),
    followersCount,
    following: state.tracker2.usernameToDetails.getIn([username, 'following']),
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
    dispatch(Tracker2Gen.createShowUser({asTracker: false, skipNav: true, username}))

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
  followers: followers ? followers.toArray() : null,
  following: following ? following.toArray() : null,
}))

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  let onAddIdentity = null
  if (
    stateProps.userIsYou &&
    flags.proofProviders &&
    stateProps._suggestionKeys &&
    stateProps._suggestionKeys.some(s => s.belowFold)
  ) {
    onAddIdentity = dispatchProps.onAddIdentity
  }

  const notAUser = stateProps.state === 'notAUserYet'
  const assertionKeys = notAUser
    ? [stateProps.username]
    : stateProps._assertions
    ? stateProps._assertions
        .sort((a, b) => a.priority - b.priority)
        .keySeq()
        .toArray()
    : null

  const onReload = notAUser
    ? () => {}
    : () => dispatchProps._onReload(stateProps.username, stateProps.userIsYou)
  return {
    assertionKeys,
    backgroundColorType: stateProps.backgroundColorType,
    followThem: stateProps.followThem,
    followersCount: stateProps.followersCount,
    followingCount: stateProps.followingCount,
    notAUser,
    onAddIdentity,
    onBack: dispatchProps.onBack,
    onEditAvatar: stateProps.userIsYou ? dispatchProps._onEditAvatar : null,
    onReload,
    onSearch: dispatchProps.onSearch,
    reason: stateProps.reason,
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
  }
}

const connected = Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Profile2')(
  Profile2
)

const Header = ({onSearch, backgroundColorType}) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <ProfileSearch whiteText={true} onSearch={onSearch} />
  </Kb.Box2>
)
const ConnectedHeader = Container.connect(
  () => ({}),
  dispatch => ({
    onSearch: () => dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'})),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Header)

// @ts-ignore let's fix this
connected.navigationOptions = p => ({
  header: undefined,
  headerBackIconColor: Styles.globalColors.white,
  headerHideBorder: false,
  headerStyle: {
    backgroundColor: Styles.globalColors.transparent,
    borderBottomColor: Styles.globalColors.transparent,
    borderBottomWidth: 1,
    borderStyle: 'solid',
  },
  headerTintColor: Styles.globalColors.white,
  headerTitle: ConnectedHeader,
  headerTitleContainerStyle: {
    left: 60,
    right: 20,
  },
  headerTransparent: true,
  underNotch: true,
})

export default connected
