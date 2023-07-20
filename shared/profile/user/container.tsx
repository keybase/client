import Profile2, {type BackgroundColorType} from '.'
import * as RouterConstants from '../../constants/router2'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ConfigConstants from '../../constants/config'
import * as Constants from '../../constants/tracker2'
import * as ProfileConstants from '../../constants/profile'
import * as Followers from '../../constants/followers'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import type * as Types from '../../constants/types/tracker2'
import {memoize} from '../../util/memoize'

export type OwnProps = {username: string}

const headerBackgroundColorType = (state: Types.DetailsState, followThem: boolean): BackgroundColorType => {
  if (['broken', 'error'].includes(state)) {
    return 'red'
  } else if (state === 'notAUserYet') {
    return 'blue'
  } else {
    return followThem ? 'green' : 'blue'
  }
}

const filterWebOfTrustEntries = memoize(
  (webOfTrustEntries: Array<Types.WebOfTrustEntry> | undefined): Array<Types.WebOfTrustEntry> =>
    webOfTrustEntries ? webOfTrustEntries.filter(Constants.showableWotEntry) : []
)

const Connected = (ownProps: OwnProps) => {
  const {username} = ownProps
  const d = Constants.useState(s => Constants.getDetails(s, username))
  const myName = ConfigConstants.useCurrentUserState(s => s.username)
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

  const followThem = Followers.useFollowerState(s => s.following.has(username))
  const followsYou = Followers.useFollowerState(s => s.followers.has(username))
  const mutualFollow = followThem && followsYou
  const _suggestionKeys = Constants.useState(s => (userIsYou ? s.proofSuggestions : undefined))
  const nonUserDetails = Constants.useState(s => Constants.getNonUserDetails(s, username))
  const stateProps = (() => {
    if (!notAUser) {
      // Keybase user
      const {followersCount, followingCount, followers, following, reason, webOfTrustEntries = []} = d

      const filteredWot = filterWebOfTrustEntries(webOfTrustEntries)
      const hasAlreadyVouched = filteredWot.some(entry => entry.attestingUser === myName)
      const vouchShowButton = mutualFollow && !hasAlreadyVouched
      const vouchDisableButton = !vouchShowButton || d.state !== 'valid' || d.resetBrokeTrack

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
        vouchDisableButton,
        vouchShowButton,
        webOfTrustEntries: filteredWot,
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
        serviceIcon: Styles.isDarkMode() ? nonUserDetails.siteIconFullDarkmode : nonUserDetails.siteIconFull,
        title,
        vouchDisableButton: true,
        vouchShowButton: false,
        webOfTrustEntries: [],
      }
    }
  })()

  const dispatch = Container.useDispatch()
  const editAvatar = ProfileConstants.useState(s => s.dispatch.editAvatar)
  const _onEditAvatar = editAvatar
  // const _onIKnowThem = (username: string, guiID: string) => {
  //   dispatch(
  //     RouteTreeGen.createNavigateAppend({path: [{props: {guiID, username}, selected: 'profileWotAuthor'}]})
  //   )
  // }
  const showUser = Constants.useState(s => s.dispatch.showUser)
  const getProofSuggestions = Constants.useState(s => s.dispatch.getProofSuggestions)
  const loadNonUserProfile = Constants.useState(s => s.dispatch.loadNonUserProfile)
  const _onReload = (username: string, isYou: boolean, state: Types.DetailsState) => {
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
  const onAddIdentity = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['profileProofsList']}))
  }
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  let allowOnAddIdentity = false
  if (
    stateProps.userIsYou &&
    stateProps._suggestionKeys &&
    stateProps._suggestionKeys.some(s => s.belowFold)
  ) {
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
    vouchDisableButton: stateProps.vouchDisableButton,
    vouchShowButton: stateProps.vouchShowButton,
    webOfTrustEntries: stateProps.webOfTrustEntries,
  }
  return <Profile2 {...props} />
}

export default Connected
