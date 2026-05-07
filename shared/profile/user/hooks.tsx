import * as C from '@/constants'
import type * as T from '@/constants/types'
import {type BackgroundColorType} from '.'
import {useColorScheme} from 'react-native'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {editAvatar} from '@/util/misc'
import {useProofSuggestions} from '../use-proof-suggestions'
import {useTrackerProfile} from '@/tracker/use-profile'

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
//     webOfTrustEntries ? webOfTrustEntries.filter(C.Tracker.showableWotEntry) : []
// )

const useUserData = (username: string) => {
  const myName = useCurrentUserState(s => s.username)
  const userIsYou = username === myName
  const {proofSuggestions, reload: reloadProofSuggestions} = useProofSuggestions(userIsYou)
  const {
    details: d,
    loadNonUserProfile,
    loadProfile,
    nonUserDetails,
  } = useTrackerProfile(username, {
    reloadOnFocus: true,
  })
  const notAUser = d.state === 'notAUserYet'

  const commonProps = {
    _assertions: undefined,
    _suggestions: undefined,
    bio: undefined,
    blocked: d.blocked,
    followThem: false,
    followers: undefined,
    followersCount: 0,
    following: undefined,
    followingCount: 0,
    followsYou: false,
    fullName: '',
    guiID: d.guiID,
    hidFromFollowers: d.hidFromFollowers,
    location: undefined,
    myName,
    name: '',
    reason: d.reason,
    sbsDescription: undefined,
    service: '',
    state: d.state,
    stellarHidden: d.stellarHidden,
    teamShowcase: d.teamShowcase,
    userIsYou,
    username,
  }

  const followThem = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))
  // const mutualFollow = followThem && followsYou

  const isDarkMode = useColorScheme() === 'dark'
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
        _suggestions: proofSuggestions,
        backgroundColorType: headerBackgroundColorType(d.state, followThem),
        bio: d.bio,
        followThem,
        followers,
        followersCount,
        following,
        followingCount,
        followsYou,
        fullName: d.fullname,
        guiID: d.guiID,
        hidFromFollowers: d.hidFromFollowers,
        location: d.location,
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
        guiID: d.guiID,
        name,
        sbsAvatarUrl: nonUserDetails.pictureUrl || undefined,
        sbsDescription: nonUserDetails.description,
        service,
        serviceIcon: isDarkMode ? nonUserDetails.siteIconFullDarkmode : nonUserDetails.siteIconFull,
        title,
        vouchDisableButton: true,
        vouchShowButton: false,
        webOfTrustEntries: [],
      }
    }
  })()

  const _onEditAvatar = editAvatar
  // const _onIKnowThem = (username: string, guiID: string) => {
  //   dispatch(
  //     RouteTreeGen.createNavigateAppend({path: [{props: {guiID, username}, selected: 'profileWotAuthor'}]})
  //   )
  // }
  const _onReload = (isYou: boolean, state: T.Tracker.DetailsState) => {
    if (state !== 'valid' && !isYou) {
      // Might be a Keybase user or not, launch non-user profile fetch.
      loadNonUserProfile()
    }
    if (state !== 'notAUserYet') {
      loadProfile()

      if (isYou) {
        reloadProofSuggestions()
      }
    }
  }
  const {navigateAppend, navigateUp} = C.Router2
  const onAddIdentity = () => {
    navigateAppend({name: 'profileProofsList', params: {}})
  }
  const onBack = () => {
    navigateUp()
  }

  let allowOnAddIdentity = false
  if (stateProps.userIsYou && stateProps._suggestions?.some(s => s.belowFold)) {
    allowOnAddIdentity = true
  }

  const assertions =
    notAUser && !!stateProps.service
      ? stateProps.service === 'phone' || stateProps.service === 'email'
        ? []
        : [
            {
              assertionKey: stateProps.username,
              belowFold: false,
              color: 'gray' as const,
              kid: '',
              metas: [{color: 'gray' as const, label: 'PENDING'}],
              pickerSubtext: '',
              pickerText: '',
              priority: 0,
              proofURL: '',
              sigID: '0',
              siteIcon: nonUserDetails.siteIcon,
              siteIconDarkmode: nonUserDetails.siteIconDarkmode,
              siteIconFull: nonUserDetails.siteIconFull,
              siteIconFullDarkmode: nonUserDetails.siteIconFullDarkmode,
              siteURL: nonUserDetails.siteURL,
              state: 'checking' as const,
              timestamp: 0,
              type: nonUserDetails.assertionKey,
              value: nonUserDetails.assertionValue,
            },
          ]
      : stateProps._assertions
        ? [...stateProps._assertions.values()].sort((a, b) => a.priority - b.priority)
        : undefined

  return {
    assertions,
    backgroundColorType: stateProps.backgroundColorType,
    bio: stateProps.bio,
    blocked: stateProps.blocked,
    followThem: stateProps.followThem,
    followers: stateProps.followers ? [...stateProps.followers] : undefined,
    followersCount: stateProps.followersCount,
    following: stateProps.following ? [...stateProps.following] : undefined,
    followingCount: stateProps.followingCount,
    followsYou: stateProps.followsYou,
    fullName: stateProps.fullName,
    guiID: stateProps.guiID,
    hidFromFollowers: stateProps.hidFromFollowers,
    location: stateProps.location,
    name: stateProps.name,
    notAUser,
    onAddIdentity: allowOnAddIdentity ? onAddIdentity : undefined,
    onBack: onBack,
    onEditAvatar: stateProps.userIsYou ? _onEditAvatar : undefined,
    // onIKnowThem:
    //   stateProps.vouchShowButton && !stateProps.vouchDisableButton
    //     ? () => _onIKnowThem(stateProps.username, stateProps.guiID)
    //     : undefined,
    onReload: () => _onReload(stateProps.userIsYou, stateProps.state),
    reason: stateProps.reason,
    sbsAvatarUrl: stateProps.sbsAvatarUrl,
    sbsDescription: stateProps.sbsDescription,
    service: stateProps.service,
    serviceIcon: stateProps.serviceIcon,
    state: stateProps.state,
    stellarHidden: stateProps.stellarHidden,
    suggestions: stateProps._suggestions ? stateProps._suggestions.filter(s => !s.belowFold) : undefined,
    teamShowcase: stateProps.teamShowcase,
    title: stateProps.title,
    userIsYou: stateProps.userIsYou,
    username: stateProps.username,
    // vouchDisableButton: stateProps.vouchDisableButton,
    // vouchShowButton: stateProps.vouchShowButton,
    // webOfTrustEntries: stateProps.webOfTrustEntries,
  }
}

export default useUserData
