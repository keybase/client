import * as C from '@/constants'
import * as Constants from '@/constants/tracker2'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import Profile2, {type BackgroundColorType} from '.'

export type OwnProps = {username: string}

const headerBackgroundColorType = (
  state: T.Tracker.DetailsState,
  followThem: boolean
): BackgroundColorType => {
  if (['broken', 'error'].includes(state)) {
    return 'red'
  } else if (state === 'notAUserYet') {
    return 'blue'
  } else {
    return followThem ? 'green' : 'blue'
  }
}

// const filterWebOfTrustEntries = memoize(
//   (
//     webOfTrustEntries: ReadonlyArray<T.Tracker.WebOfTrustEntry> | undefined
//   ): Array<T.Tracker.WebOfTrustEntry> =>
//     webOfTrustEntries ? webOfTrustEntries.filter(Constants.showableWotEntry) : []
// )

const Connected = (ownProps: OwnProps) => {
  const {username} = ownProps
  const d = C.useTrackerState(s => Constants.getDetails(s, username))
  const myName = C.useCurrentUserState(s => s.username)
  const notAUser = d.state === 'notAUserYet'
  const userIsYou = username === myName

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
    myName,
    name: '',
    reason: d.reason,
    service: '',
    state: d.state,
    userIsYou,
    username,
  }

  const followThem = C.useFollowerState(s => s.following.has(username))
  // const followsYou = C.useFollowerState(s => s.followers.has(username))
  // const mutualFollow = followThem && followsYou
  const _suggestionKeys = C.useTrackerState(s => (userIsYou ? s.proofSuggestions : undefined))
  const nonUserDetails = C.useTrackerState(s => Constants.getNonUserDetails(s, username))
  const stateProps = (() => {
    if (!notAUser) {
      // Keybase user
      const {followersCount, followingCount, followers, following, reason /*, webOfTrustEntries = []*/} = d

      // const filteredWot = filterWebOfTrustEntries(webOfTrustEntries)
      // const hasAlreadyVouched = filteredWot.some(entry => entry.attestingUser === myName)
      // const vouchShowButton = mutualFollow && !hasAlreadyVouched
      // const vouchDisableButton = !vouchShowButton || d.state !== 'valid' || d.resetBrokeTrack

      return {
        ...commonProps,
        _assertions: d.assertions,
        _suggestionKeys,
        backgroundColorType: headerBackgroundColorType(d.state, followThem),
        followThem,
        followers,
        followersCount,
        following,
        followingCount,
        reason,
        sbsAvatarUrl: undefined,
        serviceIcon: undefined,
        title: username,
        // vouchDisableButton,
        // vouchShowButton,
        // webOfTrustEntries: filteredWot,
      }
    } else {
      // SBS profile. But `nonUserDetails` might not have arrived yet,
      // make sure the screen does not appear broken until then.
      const name = nonUserDetails.assertionValue || username
      const service = nonUserDetails.assertionKey
      // For SBS profiles, display service username as the "big username". Some
      // profiles will have a special formatting for the name, e.g. phone numbers
      // will be formatted.
      const title = nonUserDetails.formattedName || name

      return {
        ...commonProps,
        backgroundColorType: headerBackgroundColorType(d.state, false),
        fullName: nonUserDetails.fullName,
        name,
        sbsAvatarUrl: nonUserDetails.pictureUrl || undefined,
        service,
        serviceIcon: Kb.Styles.isDarkMode()
          ? nonUserDetails.siteIconFullDarkmode
          : nonUserDetails.siteIconFull,
        title,
        vouchDisableButton: true,
        vouchShowButton: false,
        webOfTrustEntries: [],
      }
    }
  })()

  const editAvatar = C.useProfileState(s => s.dispatch.editAvatar)
  const _onEditAvatar = editAvatar
  // const _onIKnowThem = (username: string, guiID: string) => {
  //   dispatch(
  //     RouteTreeGen.createNavigateAppend({path: [{props: {guiID, username}, selected: 'profileWotAuthor'}]})
  //   )
  // }
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const getProofSuggestions = C.useTrackerState(s => s.dispatch.getProofSuggestions)
  const loadNonUserProfile = C.useTrackerState(s => s.dispatch.loadNonUserProfile)
  const _onReload = (username: string, isYou: boolean, state: T.Tracker.DetailsState) => {
    if (state !== 'valid' && !isYou) {
      // Might be a Keybase user or not, launch non-user profile fetch.
      loadNonUserProfile(username)
    }
    if (state !== 'notAUserYet') {
      showUser(username, false, true)

      if (isYou) {
        getProofSuggestions()
      }
    }
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onAddIdentity = () => {
    navigateAppend('profileProofsList')
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  let allowOnAddIdentity = false
  if (stateProps.userIsYou && stateProps._suggestionKeys?.some(s => s.belowFold)) {
    allowOnAddIdentity = true
  }

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

  const props = {
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
    onAddIdentity: allowOnAddIdentity ? onAddIdentity : undefined,
    onBack: onBack,
    onEditAvatar: stateProps.userIsYou ? _onEditAvatar : undefined,
    // onIKnowThem:
    //   stateProps.vouchShowButton && !stateProps.vouchDisableButton
    //     ? () => _onIKnowThem(stateProps.username, stateProps.guiID)
    //     : undefined,
    onReload: () => _onReload(stateProps.username, stateProps.userIsYou, stateProps.state),
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
    // vouchDisableButton: stateProps.vouchDisableButton,
    // vouchShowButton: stateProps.vouchShowButton,
    // webOfTrustEntries: stateProps.webOfTrustEntries,
  }
  return <Profile2 {...props} />
}

export default Connected
