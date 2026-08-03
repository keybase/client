import * as C from '@/constants'
import type * as T from '@/constants/types'
import {type BackgroundColorType} from '.'
import * as React from 'react'
import {useColorScheme} from 'react-native'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {editAvatar} from '@/util/misc'
import {useProofSuggestions} from '../use-proof-suggestions'
import {useTrackerProfile} from '@/tracker/use-profile'
import {useMutualTeams} from '@/util/use-mutual-teams'

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

const useUserData = (username: string) => {
  const myName = useCurrentUserState(s => s.username)
  const usernameKey = username.toLowerCase()
  const userIsYou = username === myName
  const {proofSuggestions, reload: reloadProofSuggestions} = useProofSuggestions(userIsYou)
  // Deliberately no reload on focus. An identify re-checks every proof, and each
  // check is an outbound request to a third-party host that rate limits us, so
  // navigating back to a profile screen that never unmounted is not worth a fresh
  // one. The mount path, an explicit pull-to-refresh, and the tracking /
  // userChanged notifications are what refresh this.
  const {
    details: d,
    loadNonUserProfile,
    loadProfile,
    nonUserDetails,
  } = useTrackerProfile(username)
  const notAUser = d.state === 'notAUserYet'

  // shares one cache with the chat channel suggestor, keyed on the usernames:
  // getMutualTeamsLocal localizes every conversation these users share and
  // remotely refreshes each one's participants, so it must not run twice for the
  // same person just because two surfaces want the answer
  const sharedTeamsUsernames = React.useMemo(() => [usernameKey], [usernameKey])
  const {loaded: sharedTeamsLoaded, teams: loadedSharedTeams} = useMutualTeams(
    sharedTeamsUsernames,
    C.waitingKeyTrackerSharedTeams(usernameKey),
    !!myName && !!username && username !== myName && !notAUser,
    d.guiID
  )
  // the shared-teams section distinguishes "not loaded yet" (spinner) from
  // "loaded, none" (renders nothing), so keep undefined until it has landed
  const sharedTeams = sharedTeamsLoaded ? loadedSharedTeams : undefined

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
    name: '',
    reason: d.reason,
    sbsDescription: undefined,
    service: '',
    state: d.state,
    stellarHidden: d.stellarHidden,
    sharedTeams,
    teamShowcase: d.teamShowcase,
    userIsYou,
    username,
  }

  const followThem = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))
  const isDarkMode = useColorScheme() === 'dark'
  const stateProps = (() => {
    if (!notAUser) {
      // Keybase user
      const {followersCount, followingCount, followers, following, reason} = d

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
      }
    }
  })()

  const _onEditAvatar = editAvatar
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
    onReload: () => _onReload(stateProps.userIsYou, stateProps.state),
    reason: stateProps.reason,
    sbsAvatarUrl: stateProps.sbsAvatarUrl,
    sbsDescription: stateProps.sbsDescription,
    service: stateProps.service,
    serviceIcon: stateProps.serviceIcon,
    state: stateProps.state,
    stellarHidden: stateProps.stellarHidden,
    sharedTeams: stateProps.sharedTeams,
    suggestions: stateProps._suggestions ? stateProps._suggestions.filter(s => !s.belowFold) : undefined,
    teamShowcase: stateProps.teamShowcase,
    title: stateProps.title,
    userIsYou: stateProps.userIsYou,
    username: stateProps.username,
  }
}

export default useUserData
