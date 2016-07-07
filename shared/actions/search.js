// @flow

import * as Constants from '../constants/search'
import engine from '../engine'
import {platformToIcon, platformToLogo32} from '../constants/search'
import {capitalize, trim} from 'lodash'
import {filterNull} from '../util/arrays'

import type {ExtraInfo, Search, Results, SelectPlatform, SelectUserForInfo, AddUserToGroup, RemoveUserFromGroup, ToggleUserGroup, SearchResult, SearchPlatforms} from '../constants/search'
import type {apiserverGetRpc, apiserverGetResult} from '../constants/types/flow-types'
import type {TypedAsyncAction} from '../constants/types/flux'

type RawResult = {
  score: number,
  keybase: ?{
    username: string,
    uid: string,
    picture_url: ?string,
    full_name: ?string,
    is_followee: boolean
  },
  service: ?{
    username: string,
    picture_url: ?string,
    bio: ?string,
    location: ?string,
    full_name: ?string
  }
}

function parseFullName (rr: RawResult): string {
  if (rr.keybase && rr.keybase.full_name) {
    return rr.keybase.full_name
  } else if (rr.service && rr.service.full_name) {
    return rr.service.full_name
  }

  return ''
}

function parseExtraInfo (platform: ?SearchPlatforms, rr: RawResult): ExtraInfo {
  const fullName = parseFullName(rr)
  const serviceName = rr.service && rr.service.service_name && capitalize(rr.service.service_name)

  if (platform === 'Keybase') {
    if (serviceName) {
      return {
        service: 'external',
        icon: platformToIcon(serviceName),
        serviceUsername: rr.service && rr.service.username || '',
        serviceAvatar: rr.service && rr.service.picture_url,
        fullNameOnService: fullName,
      }
    } else {
      return {
        service: 'none',
        fullName,
      }
    }
  } else {
    if (rr.keybase) {
      return {
        service: 'keybase',
        username: rr.keybase.username,
        fullName: fullName,
        // TODO (MM) get following status
        isFollowing: false,
      }
    } else {
      return {
        service: 'none',
        fullName,
      }
    }
  }
}

function parseRawResult (platform: SearchPlatforms, rr: RawResult): ?SearchResult {
  const extraInfo = parseExtraInfo(platform, rr)
  const serviceName = rr.service && rr.service.service_name && capitalize(rr.service.service_name)

  if (platform === 'Keybase' && rr.keybase) {
    return {
      service: 'keybase',
      username: rr.keybase.username,
      isFollowing: rr.keybase.is_followee,
      extraInfo,
    }
  } else if (serviceName) {
    return {
      service: 'external',
      icon: platformToLogo32(serviceName),
      username: rr.service && rr.service.username || '',
      serviceName,
      profileUrl: 'TODO',
      serviceAvatar: rr.service && rr.service.picture_url,
      extraInfo,
      keybaseSearchResult: rr.keybase ? parseRawResult('Keybase', rr) : null,
    }
  } else {
    return null
  }
}

function rawResults (term: string, platform: SearchPlatforms, rresults: Array<RawResult>, requestTimestamp: Date): Results {
  const results: Array<SearchResult> = filterNull(rresults.map(rr => parseRawResult(platform, rr)))

  return {
    type: Constants.results,
    payload: {term, results, requestTimestamp},
  }
}

export function search (term: string, maybePlatform: ?SearchPlatforms) : TypedAsyncAction<Search | Results> {
  return dispatch => {
    if (trim(term) === '') {
      return
    }

    // In case platform is passed in as null
    const platform: SearchPlatforms = maybePlatform || 'Keybase'

    dispatch({
      type: Constants.search,
      payload: {
        term,
        error: false,
      },
    })

    const service = {
      'Keybase': '',
      'Twitter': 'twitter',
      'Reddit': 'reddit',
      'Hackernews': 'hackernews',
      'Coinbase': 'coinbase',
      'Github': 'github',
      'Pgp': 'pgp',
    }[platform]

    const limit = 20

    const requestTimestamp = new Date()
    const params: apiserverGetRpc = {
      method: 'apiserver.Get',
      param: {
        endpoint: 'user/user_search',
        args: [
          {key: 'q', value: term},
          {key: 'num_wanted', value: String(limit)},
          {key: 'service', value: service},
        ],
      },
      incomingCallMap: {},
      callback: (error: ?any, results: apiserverGetResult) => {
        if (error) {
          console.log('Error searching. Not handling this error')
        } else {
          try {
            const json = JSON.parse(results.body)
            dispatch(rawResults(term, platform, json.list || [], requestTimestamp))
          } catch (_) {
            console.log('Error searching (json). Not handling this error')
          }
        }
      },
    }

    engine.rpc(params)
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
