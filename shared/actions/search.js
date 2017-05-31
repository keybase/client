// @flow
import * as Constants from '../constants/search'
import type {TypedAsyncAction} from '../constants/types/flux'
import {apiserverGetWithSessionRpc} from '../constants/types/flow-types'
import {capitalize, trim} from 'lodash'
import {filterNull} from '../util/arrays'
import {isFollowing as isFollowing_} from './config'

import type {
  ExtraInfo,
  Search,
  Results,
  SelectPlatform,
  SelectUserForInfo,
  AddUsersToGroup,
  RemoveUserFromGroup,
  ToggleUserGroup,
  SearchResult,
  SearchPlatforms,
  Reset,
  Waiting,
} from '../constants/search'

const {platformToLogo16, platformToLogo32, searchResultKeys} = Constants

type RawResult = {
  score: number,
  keybase: ?{
    username: string,
    uid: string,
    picture_url: ?string,
    full_name: ?string,
    is_followee: boolean,
  },
  service: ?{
    service_name: string,
    username: string,
    picture_url: ?string,
    bio: ?string,
    location: ?string,
    full_name: ?string,
  },
}

function parseExtraInfo(
  platform: SearchPlatforms,
  rr: RawResult,
  isFollowing: (username: string) => boolean
): ExtraInfo {
  // $ForceType
  const serviceName: ?SearchPlatforms = rr.service && capitalize(rr.service.service_name || '')
  let userName = ''
  if (rr.service) {
    userName = rr.service.username || ''
    if (rr.service.service_name === 'key_fingerprint') {
      const parts = [4, 8].map(idx => userName.slice(-16 - idx, -16 - idx + 4))
      userName = `...${parts.join(' ')}`
    }
  }

  if (platform === 'Keybase') {
    if (rr.service) {
      return {
        fullNameOnService: rr.service.full_name || (rr.keybase && rr.keybase.full_name) || '',
        icon: (serviceName && platformToLogo16(serviceName)) || null,
        service: 'external',
        serviceAvatar: '',
        serviceUsername: userName,
      }
    } else if (rr.keybase) {
      return {
        fullName: rr.keybase.full_name || '',
        service: 'none',
      }
    }
  } else {
    if (rr.keybase) {
      const {username, full_name: fullName} = rr.keybase
      return {
        fullName: fullName || '',
        isFollowing: isFollowing(username),
        service: 'keybase',
        username,
      }
    } else if (rr.service) {
      return {
        fullNameOnService: rr.service.full_name || '',
        icon: null,
        service: 'external',
        serviceAvatar: rr.service.picture_url || '',
        serviceUsername: userName,
      }
    }
  }

  return {
    fullName: '',
    service: 'none',
  }
}

function parseRawResult(
  platform: SearchPlatforms,
  rr: RawResult,
  isFollowing: (username: string) => boolean,
  added: Object
): ?SearchResult {
  const extraInfo = parseExtraInfo(platform, rr, isFollowing)
  // $ForceType
  const serviceName: ?SearchPlatforms =
    rr.service && rr.service.service_name && capitalize(rr.service.service_name)

  let searchResult = null
  if (platform === 'Keybase' && rr.keybase) {
    searchResult = {
      extraInfo,
      isFollowing: rr.keybase.is_followee,
      service: 'keybase',
      username: rr.keybase.username,
    }
  } else if (serviceName) {
    const toUpgrade = {...rr}
    delete toUpgrade.service
    searchResult = {
      extraInfo,
      icon: platformToLogo32(serviceName),
      keybaseSearchResult: rr.keybase ? parseRawResult('Keybase', toUpgrade, isFollowing, {}) : null,
      profileUrl: 'TODO',
      service: 'external',
      serviceAvatar: (rr.service && rr.service.picture_url) || '',
      serviceName,
      username: (rr.service && rr.service.username) || '',
    }
  } else {
    return null
  }

  if (searchResultKeys(searchResult).filter(key => added[key]).length) {
    // filter out already added
    return null
  }

  return searchResult
}

function rawResults(
  term: string,
  platform: SearchPlatforms,
  rresults: Array<RawResult>,
  requestTimestamp: Date,
  isFollowing: (username: string) => boolean,
  added: Object
): Results {
  const results: Array<SearchResult> = filterNull(
    rresults.map(rr => parseRawResult(platform, rr, isFollowing, added))
  )

  return {
    payload: {requestTimestamp, results, term},
    type: Constants.results,
  }
}

function search(term: string, maybePlatform: ?SearchPlatforms): TypedAsyncAction<Search | Results | Waiting> {
  return (dispatch, getState) => {
    // In case platform is passed in as null
    const platform: SearchPlatforms = maybePlatform || 'Keybase'

    dispatch({
      payload: {
        error: false,
        term,
      },
      type: Constants.search,
    })

    if (trim(term) === '') {
      return
    }

    const service = {
      Facebook: 'facebook',
      Github: 'github',
      Hackernews: 'hackernews',
      Keybase: '',
      Pgp: 'pgp',
      Reddit: 'reddit',
      Twitter: 'twitter',
    }[platform]

    const limit = 20

    const requestTimestamp = new Date()
    apiserverGetWithSessionRpc({
      callback: (error, results) => {
        if (error) {
          console.log('Error searching. Not handling this error')
        } else {
          try {
            const json = JSON.parse(results.body)
            const isFollowing = (username: string) => isFollowing_(getState, username)
            // map of service+username
            const added = getState().search.selectedUsers.reduce((m, cur) => {
              searchResultKeys(cur).forEach(key => {
                m[key] = true
              })
              return m
            }, {})
            dispatch(rawResults(term, platform, json.list || [], requestTimestamp, isFollowing, added))
          } catch (_) {
            console.log('Error searching (json). Not handling this error')
          }
        }
      },
      param: {
        args: [
          {key: 'q', value: term},
          {key: 'num_wanted', value: String(limit)},
          {key: 'service', value: service},
        ],
        endpoint: 'user/user_search',
      },
      waitingHandler: isWaiting => {
        dispatch(waiting(isWaiting))
      },
    })
  }
}

function waiting(waiting: boolean): Waiting {
  return {
    payload: {waiting},
    type: Constants.waiting,
  }
}

function selectPlatform(platform: SearchPlatforms): SelectPlatform {
  return {
    payload: {platform},
    type: Constants.selectPlatform,
  }
}

function selectUserForInfo(user: SearchResult): SelectUserForInfo {
  return {
    payload: {user},
    type: Constants.selectUserForInfo,
  }
}

function addUsersToGroup(users: Array<SearchResult>): AddUsersToGroup {
  return {
    payload: {users},
    type: Constants.addUsersToGroup,
  }
}

function removeUserFromGroup(user: SearchResult): RemoveUserFromGroup {
  return {
    payload: {user},
    type: Constants.removeUserFromGroup,
  }
}

function hideUserGroup(): ToggleUserGroup {
  return {
    payload: {show: false},
    type: Constants.toggleUserGroup,
  }
}

function reset(): Reset {
  return {
    payload: {},
    type: Constants.reset,
  }
}

export {addUsersToGroup, hideUserGroup, removeUserFromGroup, reset, search, selectPlatform, selectUserForInfo}
