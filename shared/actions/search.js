// @flow
import * as Constants from '../constants/search'
import type {TypedAsyncAction} from '../constants/types/flux'
import {apiserverGetRpc} from '../constants/types/flow-types'
import {capitalize, trim} from 'lodash'
import {filterNull} from '../util/arrays'
import {isFollowing as isFollowing_} from './config'

import type {ExtraInfo, Search, Results, SelectPlatform, SelectUserForInfo,
  AddUserToGroup, RemoveUserFromGroup, ToggleUserGroup, SearchResult,
  SearchPlatforms, Reset, Waiting} from '../constants/search'

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

function parseExtraInfo (platform: SearchPlatforms, rr: RawResult, isFollowing: (username: string) => boolean): ExtraInfo {
  const serviceName = rr.service && capitalize(rr.service.service_name || '')
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
        service: 'external',
        icon: serviceName && platformToLogo16(serviceName),
        serviceUsername: userName,
        serviceAvatar: '',
        fullNameOnService: rr.service.full_name || (rr.keybase && rr.keybase.full_name) || '',
      }
    } else if (rr.keybase) {
      return {
        service: 'none',
        fullName: rr.keybase.full_name || '',
      }
    }
  } else {
    if (rr.keybase) {
      return {
        service: 'keybase',
        username: rr.keybase.username,
        fullName: rr.keybase.full_name || '',
        isFollowing: isFollowing(rr.keybase.username),
      }
    } else if (rr.service) {
      return {
        service: 'external',
        icon: null,
        serviceUsername: userName,
        serviceAvatar: rr.service.picture_url || '',
        fullNameOnService: rr.service.full_name || '',
      }
    }
  }

  return {
    service: 'none',
    fullName: '',
  }
}

function parseRawResult (platform: SearchPlatforms, rr: RawResult, isFollowing: (username: string) => boolean, added: Object): ?SearchResult {
  const extraInfo = parseExtraInfo(platform, rr, isFollowing)
  const serviceName = rr.service && rr.service.service_name && capitalize(rr.service.service_name)

  let searchResult = null
  if (platform === 'Keybase' && rr.keybase) {
    searchResult = {
      service: 'keybase',
      username: rr.keybase.username,
      isFollowing: rr.keybase.is_followee,
      extraInfo,
    }
  } else if (serviceName) {
    const toUpgrade = {...rr}
    delete toUpgrade.service
    searchResult = {
      service: 'external',
      icon: platformToLogo32(serviceName),
      username: rr.service && rr.service.username || '',
      serviceAvatar: rr.service && rr.service.picture_url || '',
      serviceName,
      profileUrl: 'TODO',
      extraInfo,
      keybaseSearchResult: rr.keybase ? parseRawResult('Keybase', toUpgrade, isFollowing, {}) : null,
    }
  } else {
    return null
  }

  if (searchResultKeys(searchResult).filter(key => added[key]).length) { // filter out already added
    return null
  }

  return searchResult
}

function rawResults (term: string, platform: SearchPlatforms, rresults: Array<RawResult>,
  requestTimestamp: Date, isFollowing: (username: string) => boolean, added: Object): Results {
  const results: Array<SearchResult> = filterNull(rresults.map(rr => parseRawResult(platform, rr, isFollowing, added)))

  return {
    type: Constants.results,
    payload: {term, results, requestTimestamp},
  }
}

export function search (term: string, maybePlatform: ?SearchPlatforms) : TypedAsyncAction<Search | Results | Waiting> {
  return (dispatch, getState) => {
    // In case platform is passed in as null
    const platform: SearchPlatforms = maybePlatform || 'Keybase'

    dispatch({
      type: Constants.search,
      payload: {
        term,
        error: false,
      },
    })

    if (trim(term) === '') {
      return
    }

    const service = {
      'Keybase': '',
      'Twitter': 'twitter',
      'Reddit': 'reddit',
      'Hackernews': 'hackernews',
      'Coinbase': 'coinbase',
      'Github': 'github',
      'Pgp': 'pgp',
      'Facebook': 'facebook',
    }[platform]

    const limit = 20

    const requestTimestamp = new Date()
    apiserverGetRpc({
      param: {
        endpoint: 'user/user_search',
        args: [
          {key: 'q', value: term},
          {key: 'num_wanted', value: String(limit)},
          {key: 'service', value: service},
        ],
      },
      waitingHandler: isWaiting => { dispatch(waiting(isWaiting)) },
      callback: (error, results) => {
        if (error) {
          console.log('Error searching. Not handling this error')
        } else {
          try {
            const json = JSON.parse(results.body)
            const isFollowing = (username: string) => isFollowing_(getState, username)
            // map of service+username
            const added = getState().search.selectedUsers.reduce((m, cur) => {
              searchResultKeys(cur).forEach(key => { m[key] = true })
              return m
            }, {})
            dispatch(rawResults(term, platform, json.list || [], requestTimestamp, isFollowing, added))
          } catch (_) {
            console.log('Error searching (json). Not handling this error')
          }
        }
      },
    })
  }
}

function waiting (waiting: boolean): Waiting {
  return {
    type: Constants.waiting,
    payload: {waiting},
  }
}

export function selectPlatform (platform: SearchPlatforms): SelectPlatform {
  return {
    type: Constants.selectPlatform,
    payload: {platform},
  }
}

export function selectUserForInfo (user: SearchResult): SelectUserForInfo {
  return {
    type: Constants.selectUserForInfo,
    payload: {user},
  }
}

export function addUserToGroup (user: SearchResult): AddUserToGroup {
  return {
    type: Constants.addUserToGroup,
    payload: {user},
  }
}

export function removeUserFromGroup (user: SearchResult): RemoveUserFromGroup {
  return {
    type: Constants.removeUserFromGroup,
    payload: {user},
  }
}

export function hideUserGroup (): ToggleUserGroup {
  return {
    type: Constants.toggleUserGroup,
    payload: {show: false},
  }
}

export function reset (): Reset {
  return {
    type: Constants.reset,
    payload: {},
  }
}
