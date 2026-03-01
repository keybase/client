import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import {type BackgroundColorType} from '.'
import {useColorScheme} from 'react-native'
import {useTrackerState} from '@/stores/tracker'
import {useProfileState} from '@/stores/profile'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'

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
  const trackerState = useTrackerState(
    C.useShallow(s => {
      const _suggestionKeys = userIsYou ? s.proofSuggestions : undefined
      return {
        _suggestionKeys,
        d: s.getDetails(username),
        getProofSuggestions: s.dispatch.getProofSuggestions,
        loadNonUserProfile: s.dispatch.loadNonUserProfile,
        nonUserDetails: s.getNonUserDetails(username),
        showUser: s.dispatch.showUser,
      }
    })
  )
  const {d, getProofSuggestions, loadNonUserProfile, nonUserDetails, showUser, _suggestionKeys} = trackerState
  const notAUser = d.state === 'notAUserYet'

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

  const followThem = useFollowerState(s => s.following.has(username))
  // const followsYou = useFollowerState(s => s.followers.has(username))
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
        serviceIcon: isDarkMode ? nonUserDetails.siteIconFullDarkmode : nonUserDetails.siteIconFull,
        title,
        vouchDisableButton: true,
        vouchShowButton: false,
        webOfTrustEntries: [],
      }
    }
  })()

  const onEditAvatar = useProfileState(s => s.dispatch.editAvatar)
  const {navigateAppend, navigateUp} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      navigateUp: s.dispatch.navigateUp,
    }))
  )

  const onReload = React.useCallback(() => {
    if (d.state !== 'valid' && !userIsYou) {
      loadNonUserProfile(username)
    }
    if (d.state !== 'notAUserYet') {
      showUser(username, false, true)
      if (userIsYou) {
        getProofSuggestions()
      }
    }
  }, [d.state, userIsYou, username, loadNonUserProfile, showUser, getProofSuggestions])

  const onAddIdentity = React.useCallback(() => {
    navigateAppend('profileProofsList')
  }, [navigateAppend])

  const onBack = React.useCallback(() => {
    navigateUp()
  }, [navigateUp])

  const allowOnAddIdentity = stateProps.userIsYou && !!stateProps._suggestionKeys?.some(s => s.belowFold)

  // Memoize Set→Array conversions so downstream useMemo/useCallback deps stay stable
  const followers = React.useMemo(
    () => (stateProps.followers ? [...stateProps.followers] : undefined),
    [stateProps.followers]
  )
  const following = React.useMemo(
    () => (stateProps.following ? [...stateProps.following] : undefined),
    [stateProps.following]
  )

  const service = stateProps.service
  const impTofu = notAUser && (service === 'phone' || service === 'email')
  const assertions = stateProps._assertions
  const assertionKeys = React.useMemo(() => {
    if (notAUser && !!service) return [username]
    if (impTofu) return []
    if (assertions) {
      return [...assertions.entries()]
        .sort((a, b) => a[1].priority - b[1].priority)
        .map(e => e[0])
    }
    return undefined
  }, [notAUser, service, username, impTofu, assertions])

  const rawSuggestionKeys = stateProps._suggestionKeys
  const suggestionKeys = React.useMemo(
    () => rawSuggestionKeys?.filter(s => !s.belowFold).map(s => s.assertionKey),
    [rawSuggestionKeys]
  )

  return {
    assertionKeys,
    backgroundColorType: stateProps.backgroundColorType,
    blocked: stateProps.blocked,
    followThem: stateProps.followThem,
    followers,
    followersCount: stateProps.followersCount,
    following,
    followingCount: stateProps.followingCount,
    fullName: stateProps.fullName,
    hidFromFollowers: stateProps.hidFromFollowers,
    name: stateProps.name,
    notAUser,
    onAddIdentity: allowOnAddIdentity ? onAddIdentity : undefined,
    onBack,
    onEditAvatar: stateProps.userIsYou ? onEditAvatar : undefined,
    onReload,
    reason: stateProps.reason,
    sbsAvatarUrl: stateProps.sbsAvatarUrl,
    service: stateProps.service,
    serviceIcon: stateProps.serviceIcon,
    state: stateProps.state,
    suggestionKeys,
    title: stateProps.title,
    userIsYou: stateProps.userIsYou,
    username: stateProps.username,
  }
}

export default useUserData
