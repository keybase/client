import * as C from '@/constants'
import type * as T from '@/constants/types'
import {type BackgroundColorType} from '.'
import {useColorScheme} from 'react-native'
import {useCurrentUserState} from '@/stores/current-user'
import {useFollowerState} from '@/stores/followers'
import {useProfileState} from '@/stores/profile'
import {useTrackerState} from '@/stores/tracker'

const getHeaderBackgroundColorType = (
  state: T.Tracker.DetailsState,
  followThem: boolean
): BackgroundColorType => {
  switch (state) {
    case 'broken':
    case 'error':
      return 'red'
    case 'notAUserYet':
      return 'blue'
    default:
      return followThem ? 'green' : 'blue'
  }
}

type BaseProfileState = {
  blocked: boolean
  hidFromFollowers: boolean
  reason: string
  state: T.Tracker.DetailsState
  userIsYou: boolean
  username: string
}

type UserProfileState = BaseProfileState & {
  assertions?: T.Tracker.Details['assertions']
  backgroundColorType: BackgroundColorType
  followThem: boolean
  followers?: T.Tracker.Details['followers']
  followersCount?: number
  following?: T.Tracker.Details['following']
  followingCount?: number
  fullName: string
  name: string
  sbsAvatarUrl?: string
  service: string
  serviceIcon?: ReadonlyArray<T.Tracker.SiteIcon>
  suggestionEntries?: ReadonlyArray<T.Tracker.Assertion>
  title: string
}

const getBaseProfileState = ({
  details,
  userIsYou,
  username,
}: {
  details: T.Tracker.Details
  userIsYou: boolean
  username: string
}): BaseProfileState => ({
  blocked: details.blocked,
  hidFromFollowers: details.hidFromFollowers,
  reason: details.reason,
  state: details.state,
  userIsYou,
  username,
})

const getKeybaseProfileState = ({
  baseProfileState,
  details,
  followThem,
  suggestionEntries,
}: {
  baseProfileState: BaseProfileState
  details: T.Tracker.Details
  followThem: boolean
  suggestionEntries?: ReadonlyArray<T.Tracker.Assertion>
}): UserProfileState => ({
  ...baseProfileState,
  assertions: details.assertions,
  backgroundColorType: getHeaderBackgroundColorType(details.state, followThem),
  followThem,
  followers: details.followers,
  followersCount: details.followersCount,
  following: details.following,
  followingCount: details.followingCount,
  fullName: '',
  name: '',
  service: '',
  suggestionEntries,
  title: baseProfileState.username,
})

const getSbsProfileState = ({
  baseProfileState,
  details,
  isDarkMode,
  nonUserDetails,
}: {
  baseProfileState: BaseProfileState
  details: T.Tracker.Details
  isDarkMode: boolean
  nonUserDetails: T.Tracker.NonUserDetails
}): UserProfileState => {
  const name = nonUserDetails.assertionValue || baseProfileState.username
  const service = nonUserDetails.assertionKey
  const title = nonUserDetails.formattedName || name

  return {
    ...baseProfileState,
    backgroundColorType: getHeaderBackgroundColorType(details.state, false),
    followThem: false,
    followersCount: 0,
    followingCount: 0,
    fullName: nonUserDetails.fullName,
    name,
    sbsAvatarUrl: nonUserDetails.pictureUrl || undefined,
    service,
    serviceIcon: isDarkMode ? nonUserDetails.siteIconFullDarkmode : nonUserDetails.siteIconFull,
    title,
  }
}

const getAssertionKeys = ({
  assertions,
  notAUser,
  service,
  username,
}: {
  assertions?: T.Tracker.Details['assertions']
  notAUser: boolean
  service: string
  username: string
}) => {
  if (notAUser && (service === 'phone' || service === 'email')) {
    return []
  }

  if (notAUser && service) {
    return [username]
  }

  return assertions
    ? [...assertions.entries()].sort((a, b) => a[1].priority - b[1].priority).map(([assertionKey]) => assertionKey)
    : undefined
}

const getSuggestionKeys = (suggestionEntries?: ReadonlyArray<T.Tracker.Assertion>) =>
  suggestionEntries ? suggestionEntries.filter(s => !s.belowFold).map(s => s.assertionKey) : undefined

const shouldAllowAddIdentity = (userIsYou: boolean, suggestionEntries?: ReadonlyArray<T.Tracker.Assertion>) =>
  userIsYou && !!suggestionEntries?.some(s => s.belowFold)

const useUserData = (username: string) => {
  const myName = useCurrentUserState(s => s.username)
  const userIsYou = username === myName
  const trackerState = useTrackerState(
    C.useShallow(s => ({
      details: s.getDetails(username),
      getProofSuggestions: s.dispatch.getProofSuggestions,
      loadNonUserProfile: s.dispatch.loadNonUserProfile,
      nonUserDetails: s.getNonUserDetails(username),
      showUser: s.dispatch.showUser,
      suggestionEntries: userIsYou ? s.proofSuggestions : undefined,
    }))
  )
  const {details, getProofSuggestions, loadNonUserProfile, nonUserDetails, showUser, suggestionEntries} =
    trackerState
  const followThem = useFollowerState(s => s.following.has(username))
  const isDarkMode = useColorScheme() === 'dark'
  const notAUser = details.state === 'notAUserYet'

  const baseProfileState = getBaseProfileState({details, userIsYou, username})
  const profileState = notAUser
    ? getSbsProfileState({baseProfileState, details, isDarkMode, nonUserDetails})
    : getKeybaseProfileState({baseProfileState, details, followThem, suggestionEntries})

  const editAvatar = useProfileState(s => s.dispatch.editAvatar)
  const {navigateAppend, navigateUp} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      navigateUp: s.dispatch.navigateUp,
    }))
  )

  const onReload = () => {
    if (details.state !== 'valid' && !userIsYou) {
      loadNonUserProfile(username)
    }
    if (details.state !== 'notAUserYet') {
      showUser(username, false, true)
      if (userIsYou) {
        getProofSuggestions()
      }
    }
  }

  const onAddIdentity = shouldAllowAddIdentity(profileState.userIsYou, profileState.suggestionEntries)
    ? () => navigateAppend('profileProofsList')
    : undefined

  return {
    assertionKeys: getAssertionKeys({
      assertions: profileState.assertions,
      notAUser,
      service: profileState.service,
      username: profileState.username,
    }),
    backgroundColorType: profileState.backgroundColorType,
    blocked: profileState.blocked,
    followThem: profileState.followThem,
    followers: profileState.followers ? [...profileState.followers] : undefined,
    followersCount: profileState.followersCount,
    following: profileState.following ? [...profileState.following] : undefined,
    followingCount: profileState.followingCount,
    fullName: profileState.fullName,
    hidFromFollowers: profileState.hidFromFollowers,
    name: profileState.name,
    notAUser,
    onAddIdentity,
    onBack: navigateUp,
    onEditAvatar: profileState.userIsYou ? editAvatar : undefined,
    onReload,
    reason: profileState.reason,
    sbsAvatarUrl: profileState.sbsAvatarUrl,
    service: profileState.service,
    serviceIcon: profileState.serviceIcon,
    state: profileState.state,
    suggestionKeys: getSuggestionKeys(profileState.suggestionEntries),
    title: profileState.title,
    userIsYou: profileState.userIsYou,
    username: profileState.username,
  }
}

export default useUserData
