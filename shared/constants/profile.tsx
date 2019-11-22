import * as RPCGen from './types/rpc-gen'
import * as Types from './types/profile'
import * as I from 'immutable'
import {TypedState} from '../util/container'
import {peopleTab} from './tabs'
import {parseUserId} from '../util/platforms'

export const makeInitialState = (): Types.State => ({
  errorText: '',
  pgpEmail1: '',
  pgpEmail2: '',
  pgpEmail3: '',
  pgpErrorEmail1: false,
  pgpErrorEmail2: false,
  pgpErrorEmail3: false,
  pgpErrorText: '',
  pgpFullName: '',
  pgpPublicKey: '',
  platformGenericChecking: false,
  promptShouldStoreKeyOnServer: false,
  proofFound: false,
  proofText: '',
  revokeError: '',
  searchShowingSuggestions: false,
  username: '',
  usernameValid: true,
})

export const makeProveGenericParams = (): Types.ProveGenericParams => ({
  buttonLabel: '',
  logoBlack: [],
  logoFull: [],
  subtext: '',
  suffix: '',
  title: '',
})

export const toProveGenericParams = (p: RPCGen.ProveParameters): Types.ProveGenericParams => ({
  ...makeProveGenericParams(),
  buttonLabel: p.buttonLabel,
  logoBlack: p.logoBlack || [],
  logoFull: p.logoFull || [],
  subtext: p.subtext,
  suffix: p.suffix,
  title: p.title,
})

export const waitingKey = 'profile:waiting'
export const uploadAvatarWaitingKey = 'profile:uploadAvatar'
export const blockUserWaitingKey = 'profile:blockUser'
export const maxProfileBioChars = 255
export const AVATAR_SIZE = 128
export const BACK_ZINDEX = 12
export const SEARCH_CONTAINER_ZINDEX = BACK_ZINDEX + 1
export const ADD_TO_TEAM_ZINDEX = SEARCH_CONTAINER_ZINDEX + 1
export const ROLE_PICKER_ZINDEX = ADD_TO_TEAM_ZINDEX + 1
export const EDIT_AVATAR_ZINDEX = SEARCH_CONTAINER_ZINDEX + 1

export const getProfilePath = (
  peopleRouteProps: I.List<{
    node: string | null
    props: I.Map<string, any>
  }>,
  username: string,
  _: string,
  _state: TypedState
) => {
  const onlyProfilesProps = peopleRouteProps.filter(
    segment => segment.node && [peopleTab, 'profile', 'profileNonUserProfile'].includes(segment.node)
  )
  const onlyProfilesPath: Array<{
    selected: string | null
    props: any
  }> = onlyProfilesProps
    .map(segment => ({
      props: segment.props.toObject(),
      selected: segment.node || null,
    }))
    .toArray()
  // Assume user exists
  if (!username.includes('@')) {
    if (onlyProfilesProps.size <= 1) {
      // There's nothing on the peopleTab stack
      return [peopleTab, {props: {username}, selected: 'profile'}]
    }
    // check last entry in path
    const topProfile = onlyProfilesProps.get(onlyProfilesProps.size - 1)
    if (!topProfile) {
      // Will never happen
      throw new Error('topProps undefined in _showUserProfile!')
    }
    if (topProfile.node === 'profile' && topProfile.props.get('username') === username) {
      // This user is already the top profile
      return onlyProfilesPath
    }
    // Push the user onto the stack
    return [...onlyProfilesPath, {props: {username}, selected: 'profile'}]
  }

  // search for user first
  const {username: parsedUsername, serviceId} = parseUserId(username)
  const props = {
    fullUsername: username,
    serviceId,
    username: parsedUsername,
  }
  if (onlyProfilesPath.length > 0) {
    // Check for duplicates
    const topProfile = onlyProfilesPath[onlyProfilesPath.length - 1]
    if (
      (topProfile.props && topProfile.props.fullUsername !== props.fullUsername) ||
      (topProfile.props && topProfile.props.serviceId !== props.serviceId)
    ) {
      // This user is not the top profile, push on top
      onlyProfilesPath.push({props, selected: 'profileNonUserProfile'})
    }
  }
  return onlyProfilesPath
}
