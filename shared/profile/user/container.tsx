import * as I from 'immutable'
import * as Constants from '../../constants/tracker2'
import {getShowAirdropBanner} from '../../constants/wallets'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as SearchGen from '../../actions/search-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/tracker2'
import Profile2 from '.'
import {memoize} from '../../util/memoize'
import flags from '../../util/feature-flags'

type OwnProps = Container.RouteProps<{username: string}>

const headerBackgroundColorType = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return 'red' as const
  } else if (state === 'notAUserYet') {
    return 'blue' as const
  } else {
    return followThem ? ('green' as const) : ('blue' as const)
  }
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const username = Container.getRouteProps(ownProps, 'username', '')
  const d = Constants.getDetails(state, username)
  const notAUser = d.state === 'notAUserYet'
  const userIsYou = username === state.config.username
  const showAirdropBanner = getShowAirdropBanner(state)

  const commonProps = {
    _assertions: null,
    _suggestionKeys: null,
    followThem: false,
    followers: undefined,
    followersCount: 0,
    following: undefined,
    followingCount: 0,
    fullName: '',
    guiID: d.guiID,
    name: '',
    reason: d.reason,
    service: '',
    showAirdropBanner,
    state: d.state,
    userIsYou,
    username,
    youAreInAirdrop: false,
  }

  if (!notAUser) {
    // Keybase user
    const followThem = Constants.followThem(state, username)
    const followersCount = state.tracker2.usernameToDetails.getIn([username, 'followersCount']) as
      | number
      | undefined
    const followingCount = state.tracker2.usernameToDetails.getIn([username, 'followingCount']) as
      | number
      | undefined

    return {
      ...commonProps,
      _assertions: d.assertions,
      _suggestionKeys: userIsYou ? state.tracker2.proofSuggestions : null,
      backgroundColorType: headerBackgroundColorType(d.state, followThem),
      followThem,
      followers: state.tracker2.usernameToDetails.getIn([username, 'followers']) as
        | I.OrderedSet<string>
        | undefined,
      followersCount,
      following: state.tracker2.usernameToDetails.getIn([username, 'following']) as
        | I.OrderedSet<string>
        | undefined,
      followingCount,
      reason: d.reason,
      sbsAvatarUrl: undefined,
      serviceIcon: null,
      title: username,
    }
  } else {
    // SBS profile. But `nonUserDetails` might not have arrived yet,
    // make sure the screen does not appear broken until then.
    const nonUserDetails = Constants.getNonUserDetails(state, username)
    const name = nonUserDetails.assertionValue || username
    const service = nonUserDetails.assertionKey
    // For SBS profiles, display service username as the "big username". Some
    // profiles will have a special formatting for the name, e.g. phone numbers
    // will be formatted.
    let title = nonUserDetails.formattedName || name

    return {
      ...commonProps,
      backgroundColorType: headerBackgroundColorType(d.state, false),
      fullName: nonUserDetails.fullName,
      name,
      sbsAvatarUrl: nonUserDetails.pictureUrl || undefined,
      service,
      serviceIcon: nonUserDetails.siteIconFull,
      title,
    }
  }
}
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onEditAvatar: () => dispatch(ProfileGen.createEditAvatar()),
  _onReload: (username: string, isYou: boolean, state: Types.DetailsState) => {
    if (state !== 'valid') {
      // Might be a Keybase user or not, launch non-user profile fetch.
      dispatch(Tracker2Gen.createLoadNonUserProfile({assertion: username}))
    }
    if (state !== 'notAUserYet') {
      dispatch(Tracker2Gen.createShowUser({asTracker: false, skipNav: true, username}))

      if (isYou) {
        dispatch(Tracker2Gen.createGetProofSuggestions())
      }
    }
  },
  onAddIdentity: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileProofsList']})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSearch: () => {
    dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'}))
  },
})

const followToArray = memoize((followers?: I.OrderedSet<string>, following?: I.OrderedSet<string>) => ({
  followers: followers ? followers.toArray() : null,
  following: following ? following.toArray() : null,
}))

const connected = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    let onAddIdentity: (() => void) | null = null
    if (
      stateProps.userIsYou &&
      flags.proofProviders &&
      stateProps._suggestionKeys &&
      stateProps._suggestionKeys.some(s => s.belowFold)
    ) {
      onAddIdentity = dispatchProps.onAddIdentity
    }

    const notAUser = stateProps.state === 'notAUserYet'
    let assertionKeys =
      notAUser && !!stateProps.service
        ? [stateProps.username]
        : stateProps._assertions
        ? stateProps._assertions
            .sort((a, b) => a.priority - b.priority)
            .keySeq()
            .toArray()
        : null

    // For 'phone' or 'email' profiles do not display placeholder assertions.
    const service = stateProps.service
    const impTofu = notAUser && (service === 'phone' || service === 'email')
    if (impTofu) {
      assertionKeys = []
    }

    return {
      assertionKeys,
      backgroundColorType: stateProps.backgroundColorType,
      followThem: stateProps.followThem,
      followersCount: stateProps.followersCount,
      followingCount: stateProps.followingCount,
      fullName: stateProps.fullName,
      name: stateProps.name,
      notAUser,
      onAddIdentity,
      onBack: dispatchProps.onBack,
      onEditAvatar: stateProps.userIsYou ? dispatchProps._onEditAvatar : null,
      onReload: () => dispatchProps._onReload(stateProps.username, stateProps.userIsYou, stateProps.state),
      onSearch: dispatchProps.onSearch,
      reason: stateProps.reason,
      sbsAvatarUrl: stateProps.sbsAvatarUrl,
      service: stateProps.service,
      serviceIcon: stateProps.serviceIcon,
      showAirdropBanner: stateProps.showAirdropBanner,
      state: stateProps.state,
      suggestionKeys: stateProps._suggestionKeys
        ? stateProps._suggestionKeys
            .filter(s => !s.belowFold)
            .map(s => s.assertionKey)
            .toArray()
        : null,
      title: stateProps.title,
      userIsYou: stateProps.userIsYou,
      username: stateProps.username,
      ...followToArray(stateProps.followers, stateProps.following),
    }
  },
  'Profile2'
)(Profile2)

export default connected
