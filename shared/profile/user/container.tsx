import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import Profile2, {BackgroundColorType} from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as Types from '../../constants/types/tracker2'

export type OwnProps = Container.RouteProps<{username: string}>

const headerBackgroundColorType = (state: Types.DetailsState, followThem: boolean): BackgroundColorType => {
  if (['broken', 'error'].includes(state)) {
    return 'red'
  } else if (state === 'notAUserYet') {
    return 'blue'
  } else {
    return followThem ? 'green' : 'blue'
  }
}

const connected = Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const username = Container.getRouteProps(ownProps, 'username', '')
    const d = Constants.getDetails(state, username)
    const notAUser = d.state === 'notAUserYet'
    const userIsYou = username === state.config.username

    const commonProps = {
      _assertions: undefined,
      _suggestionKeys: undefined,
      blocked: d.blocked,
      followThem: false,
      followers: undefined,
      followersCount: 0,
      following: undefined,
      followingCount: 0,
      fullName: '',
      guiID: d.guiID,
      hidFromFollowers: d.hidFromFollowers,
      name: '',
      reason: d.reason,
      service: '',
      state: d.state,
      userIsYou,
      username,
    }

    if (!notAUser) {
      // Keybase user
      const followThem = Constants.followThem(state, username)
      const {followersCount, followingCount, followers, following, reason} = d
      const webOfTrustEntries = (d.webOfTrustEntries || []).filter(entry => Types.showableWotEntry(entry))

      const mutualFollow = followThem && Constants.followsYou(state, username)
      const hasntAlreadyVouched = webOfTrustEntries.every(
        entry => entry.attestingUser !== state.config.username
      )
      const promptForVouch = mutualFollow && hasntAlreadyVouched

      return {
        ...commonProps,
        _assertions: d.assertions,
        _suggestionKeys: userIsYou ? state.tracker2.proofSuggestions : undefined,
        backgroundColorType: headerBackgroundColorType(d.state, followThem),
        followThem,
        followers,
        followersCount,
        following,
        followingCount,
        promptForVouch,
        reason,
        sbsAvatarUrl: undefined,
        serviceIcon: undefined,
        title: username,
        webOfTrustEntries,
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
        promptForVouch: false,
        sbsAvatarUrl: nonUserDetails.pictureUrl || undefined,
        service,
        serviceIcon: Styles.isDarkMode() ? nonUserDetails.siteIconFullDarkmode : nonUserDetails.siteIconFull,
        title,
        webOfTrustEntries: [],
      }
    }
  },
  dispatch => ({
    _onEditAvatar: () => dispatch(ProfileGen.createEditAvatar()),
    _onIKnowThem: (username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profileWotAuthor'}]})
      ),
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
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    let onAddIdentity: (() => void) | undefined
    if (
      stateProps.userIsYou &&
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
        ? [...stateProps._assertions.entries()].sort((a, b) => a[1].priority - b[1].priority).map(e => e[0])
        : undefined

    // For 'phone' or 'email' profiles do not display placeholder assertions.
    const service = stateProps.service
    const impTofu = notAUser && (service === 'phone' || service === 'email')
    if (impTofu) {
      assertionKeys = []
    }

    return {
      assertionKeys,
      backgroundColorType: stateProps.backgroundColorType,
      blocked: stateProps.blocked,
      followThem: stateProps.followThem,
      followers: stateProps.followers ? [...stateProps.followers] : undefined,
      followersCount: stateProps.followersCount,
      following: stateProps.following ? [...stateProps.following] : undefined,
      followingCount: stateProps.followingCount,
      fullName: stateProps.fullName,
      hidFromFollowers: stateProps.hidFromFollowers,
      name: stateProps.name,
      notAUser,
      onAddIdentity,
      onBack: dispatchProps.onBack,
      onEditAvatar: stateProps.userIsYou ? dispatchProps._onEditAvatar : undefined,
      onIKnowThem: stateProps.promptForVouch
        ? () => dispatchProps._onIKnowThem(stateProps.username)
        : undefined,
      onReload: () => dispatchProps._onReload(stateProps.username, stateProps.userIsYou, stateProps.state),
      reason: stateProps.reason,
      sbsAvatarUrl: stateProps.sbsAvatarUrl,
      service: stateProps.service,
      serviceIcon: stateProps.serviceIcon,
      state: stateProps.state,
      suggestionKeys: stateProps._suggestionKeys
        ? stateProps._suggestionKeys.filter(s => !s.belowFold).map(s => s.assertionKey)
        : undefined,
      title: stateProps.title,
      userIsYou: stateProps.userIsYou,
      username: stateProps.username,
      webOfTrustEntries: stateProps.webOfTrustEntries || [],
    }
  },
  'Profile2'
)(Profile2)

export default connected
