import * as C from '@/constants'
import * as T from '@/constants/types'
import {type BackgroundColorType} from '.'
import * as React from 'react'
import {useColorScheme} from 'react-native'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {editAvatar} from '@/util/misc'
import {useProofSuggestions} from '../use-proof-suggestions'
import {useTrackerProfile} from '@/tracker/use-profile'
import {RPCError} from '@/util/errors'
import logger from '@/logger'

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

const loadSharedTeams = async (
  requestUsernameKey: string,
  requestID: number,
  requestIDRef: {current: number},
  setSharedTeamsState: (s: {teams?: ReadonlyArray<T.RPCChat.SharedTeam>; usernameKey: string}) => void
) => {
  try {
    const res = await T.RPCChat.localGetMutualTeamsLocalRpcPromise(
      {usernames: [requestUsernameKey]},
      C.waitingKeyTrackerSharedTeams(requestUsernameKey)
    )
    if (requestIDRef.current !== requestID) {
      return
    }
    const teams = res.teams ?? []
    setSharedTeamsState({teams, usernameKey: requestUsernameKey})
  } catch (error) {
    if (requestIDRef.current !== requestID) {
      return
    }
    if (error instanceof RPCError) {
      logger.error(`Error loading shared teams: ${error.message}`)
    } else {
      logger.error('Error loading shared teams: non-RPC error', error)
    }
  }
}

const useUserData = (username: string) => {
  const myName = useCurrentUserState(s => s.username)
  const usernameKey = username.toLowerCase()
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
  const requestIDRef = React.useRef(0)
  const [sharedTeamsState, setSharedTeamsState] = React.useState<{
    teams?: ReadonlyArray<T.RPCChat.SharedTeam>
    usernameKey: string
  }>({teams: undefined, usernameKey})
  const notAUser = d.state === 'notAUserYet'

  React.useEffect(() => {
    if (!myName || !username || username === myName || notAUser) {
      return
    }
    const requestUsernameKey = usernameKey
    const requestID = requestIDRef.current + 1
    requestIDRef.current = requestID
    C.ignorePromise(loadSharedTeams(requestUsernameKey, requestID, requestIDRef, setSharedTeamsState))
    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [d.guiID, myName, notAUser, username, usernameKey])

  const sharedTeams = sharedTeamsState.usernameKey === usernameKey ? sharedTeamsState.teams : undefined

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
