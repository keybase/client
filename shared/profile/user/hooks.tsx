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

// Compute a stable primitive string from assertion entries. The assertions Map
// gets a new reference on every Immer store update, but the sorted keys are
// the same unless assertions actually change. By joining to a string (primitive),
// downstream useMemo deps compare by value rather than reference.
const assertionKeysToStr = (assertions: ReadonlyMap<string, T.Tracker.Assertion> | undefined): string | undefined => {
  if (!assertions) return undefined
  return [...assertions.entries()]
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(e => e[0])
    .join('\0')
}

const useUserData = (username: string) => {
  const myName = useCurrentUserState(s => s.username)
  const userIsYou = username === myName

  // Select individual properties from Details instead of the whole `d` object.
  // Immer creates a new Details object on every assertion verification, but
  // primitives compare equal by value and untouched Sets keep the same reference,
  // so useShallow won't trigger re-renders for assertion-only updates.
  const trackerState = useTrackerState(
    C.useShallow(s => {
      const d = s.getDetails(username)
      const _suggestionKeys = userIsYou ? s.proofSuggestions : undefined
      return {
        _suggestionKeys,
        assertionKeysStr: assertionKeysToStr(d.assertions),
        blocked: d.blocked,
        detailState: d.state,
        followers: d.followers,
        followersCount: d.followersCount,
        following: d.following,
        followingCount: d.followingCount,
        getProofSuggestions: s.dispatch.getProofSuggestions,
        hidFromFollowers: d.hidFromFollowers,
        loadNonUserProfile: s.dispatch.loadNonUserProfile,
        nonUserDetails: s.getNonUserDetails(username),
        reason: d.reason,
        showUser: s.dispatch.showUser,
      }
    })
  )
  const {
    _suggestionKeys, assertionKeysStr, blocked, detailState, followers: followersSet,
    followersCount, following: followingSet, followingCount, getProofSuggestions,
    hidFromFollowers, loadNonUserProfile, nonUserDetails, reason, showUser,
  } = trackerState

  const notAUser = detailState === 'notAUserYet'

  const followThem = useFollowerState(s => s.following.has(username))

  const isDarkMode = useColorScheme() === 'dark'

  // Compute background color
  const backgroundColorType = headerBackgroundColorType(detailState, notAUser ? false : followThem)

  // SBS-specific derived values
  const sbsName = notAUser ? (nonUserDetails.assertionValue || username) : ''
  const sbsService = notAUser ? nonUserDetails.assertionKey : ''
  const sbsTitle = notAUser ? (nonUserDetails.formattedName || sbsName) : ''
  const sbsFullName = notAUser ? nonUserDetails.fullName : ''
  const sbsAvatarUrl = notAUser ? (nonUserDetails.pictureUrl || undefined) : undefined
  const sbsServiceIcon = notAUser
    ? (isDarkMode ? nonUserDetails.siteIconFullDarkmode : nonUserDetails.siteIconFull)
    : undefined

  const onEditAvatar = useProfileState(s => s.dispatch.editAvatar)
  const {navigateAppend, navigateUp} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      navigateUp: s.dispatch.navigateUp,
    }))
  )

  const onReload = React.useCallback(() => {
    if (detailState !== 'valid' && !userIsYou) {
      loadNonUserProfile(username)
    }
    if (detailState !== 'notAUserYet') {
      showUser(username, false, true)
      if (userIsYou) {
        getProofSuggestions()
      }
    }
  }, [detailState, userIsYou, username, loadNonUserProfile, showUser, getProofSuggestions])

  const onAddIdentity = React.useCallback(() => {
    navigateAppend('profileProofsList')
  }, [navigateAppend])

  const onBack = React.useCallback(() => {
    navigateUp()
  }, [navigateUp])

  const allowOnAddIdentity = userIsYou && !!_suggestionKeys?.some(s => s.belowFold)

  // Memoize Set→Array conversions so downstream deps stay stable.
  // Immer reuses untouched Sets, so these only bust when followers/following actually change.
  const followers = React.useMemo(
    () => (followersSet ? [...followersSet] : undefined),
    [followersSet]
  )
  const following = React.useMemo(
    () => (followingSet ? [...followingSet] : undefined),
    [followingSet]
  )

  const service = notAUser ? sbsService : ''
  const impTofu = notAUser && (service === 'phone' || service === 'email')

  // assertionKeysStr is already a primitive string from the selector, so useMemo
  // compares by value and won't bust when the Map reference changes.
  const assertionKeys = React.useMemo(() => {
    if (notAUser && !!service) return [username]
    if (impTofu) return []
    if (assertionKeysStr !== undefined) return assertionKeysStr.split('\0')
    return undefined
  }, [notAUser, service, username, impTofu, assertionKeysStr])

  const suggestionKeys = React.useMemo(
    () => _suggestionKeys?.filter(s => !s.belowFold).map(s => s.assertionKey),
    [_suggestionKeys]
  )

  return {
    assertionKeys,
    backgroundColorType,
    blocked,
    followThem,
    followers,
    followersCount: followersCount ?? 0,
    following,
    followingCount: followingCount ?? 0,
    fullName: notAUser ? sbsFullName : '',
    hidFromFollowers,
    name: notAUser ? sbsName : '',
    notAUser,
    onAddIdentity: allowOnAddIdentity ? onAddIdentity : undefined,
    onBack,
    onEditAvatar: userIsYou ? onEditAvatar : undefined,
    onReload,
    reason,
    sbsAvatarUrl,
    service,
    serviceIcon: sbsServiceIcon,
    state: detailState,
    suggestionKeys,
    title: notAUser ? sbsTitle : username,
    userIsYou,
    username,
  }
}

export default useUserData
