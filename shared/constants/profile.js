// @flow
import type {State} from './types/profile'
import * as I from 'immutable'
import {type TypedState} from '../util/container'
import flags from '../util/feature-flags'
import {peopleTab} from '../constants/tabs'
import {serviceIdToService} from './search'
import {parseUserId} from '../util/platforms'
import {searchResultSelector} from './selectors'
import {type PropsPath} from '../route-tree'

const initialState: State = {
  errorCode: null,
  errorText: null,
  pgpInfo: {
    email1: null,
    email2: null,
    email3: null,
    errorEmail1: false,
    errorEmail2: false,
    errorEmail3: false,
    errorText: null,
    fullName: null,
  },
  pgpPublicKey: null,
  platform: null,
  proofFound: false,
  proofStatus: null,
  proofText: null,
  revoke: {
    error: null,
    waiting: null,
  },
  sigID: null,
  username: '',
  usernameValid: true,
  waiting: false,
  searchResults: null,
  searchShowingSuggestions: false,
}

const maxProfileBioChars = 256

// A simple check, the server does a fuller check
function checkBTC(address: string): boolean {
  return !!address.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
}

// A simple check, the server does a fuller check
function checkZcash(address: string): boolean {
  return true // !!address.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
}

function checkUsernameValid(platform: ?string, username: string): boolean {
  if (platform === 'btc') {
    return checkBTC(username)
  } else if (platform === 'zcash') {
    return checkZcash(username)
  } else {
    return true
  }
}

function cleanupUsername(platform: ?string, username: string): string {
  if (['http', 'https'].includes(platform)) {
    // Ensure that only the hostname is getting returned, with no
    // protocal, port, or path information
    return (
      username &&
      username
        .replace(/^.*?:\/\//, '') // Remove protocal information (if present)
        .replace(/:.*/, '') // Remove port information (if present)
        .replace(/\/.*/, '')
    ) // Remove path information (if present)
  }
  return username
}

function urlToUsername(url: URL): ?string {
  const protocol = url.protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    return null
  }

  if (url.username || url.password) {
    return null
  }

  const hostname = url.hostname
  if (hostname !== 'keybase.io' && hostname !== 'www.keybase.io') {
    return null
  }

  const port = url.port
  if (port) {
    if (protocol === 'http:' && port !== '80') {
      return null
    }

    if (protocol === 'https:' && port !== '443') {
      return null
    }
  }

  const pathname = url.pathname
  // Adapted username regexp (see libkb/checkers.go) with a leading / and an
  // optional trailing /.
  const match = pathname.match(/^\/((?:[a-zA-Z0-9][a-zA-Z0-9_]?)+)\/?$/)
  if (!match) {
    return null
  }

  const usernameMatch = match[1]
  if (usernameMatch.length < 2 || usernameMatch.length > 16) {
    return null
  }

  // Ignore query string and hash parameters.

  const username = usernameMatch.toLowerCase()
  return username
}

const getProfilePath = (
  peopleRouteProps: I.List<{node: ?string, props: I.Map<string, any>}>,
  username: string,
  me: string,
  state: TypedState
): PropsPath<*> => {
  const {newPeopleTab} = flags
  const onlyProfilesProps = peopleRouteProps.filter(segment =>
    [peopleTab, 'profile', 'nonUserProfile'].includes(segment.node)
  )
  const onlyProfilesPath = onlyProfilesProps.toArray().map(segment => ({
    selected: segment.node || null,
    props: segment.props.toObject(),
  }))
  // Assume user exists
  if (!username.includes('@')) {
    if (onlyProfilesProps.size <= 1) {
      // There's nothing on the peopleTab stack
      if (username === me && !newPeopleTab) {
        // I'm already the root of the tab
        return [peopleTab]
      }
      return [peopleTab, {selected: 'profile', props: {username}}]
    }
    // check last entry in path
    const topNode = onlyProfilesProps.get(onlyProfilesProps.size - 1)
    if (!topNode) {
      // Will never happen
      throw new Error('topProps undefined in _showUserProfile!')
    }
    if (topNode.node === 'profile' && topNode.props.get('username') === username) {
      return onlyProfilesPath
    }
    return [...onlyProfilesPath, {selected: 'profile', props: {username}}]
  }

  // search for user first
  let props = {}
  const searchResult = searchResultSelector(state, username)
  if (searchResult) {
    props = {
      fullname: searchResult.leftFullname,
      fullUsername: username,
      serviceName: searchResult.leftService,
      username: searchResult.leftUsername,
    }
  } else {
    const {username: parsedUsername, serviceId} = parseUserId(username)
    props = {
      fullUsername: username,
      serviceName: serviceIdToService(serviceId),
      username: parsedUsername,
    }
  }
  if (onlyProfilesPath.length > 0) {
    // don't allow dupe
    const topProfile = onlyProfilesPath[onlyProfilesPath.length - 1]
    if (
      // $FlowIssue not sure why it thinks topProfile is a string
      topProfile.props.fullUsername !== props.fullUsername ||
      topProfile.props.serviceName !== props.serviceName
    ) {
      onlyProfilesPath.push({selected: 'nonUserProfile', props})
    }
  }
  return onlyProfilesPath
}

export {checkUsernameValid, cleanupUsername, getProfilePath, initialState, maxProfileBioChars, urlToUsername}
