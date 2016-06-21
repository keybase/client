import * as Constants from '../constants/search'
import {platformToIcon, platformToLogo32} from '../constants/search'
import {filterNull} from '../util/arrays'

import type {ExtraInfo, Search, Results, SelectPlatform} from '../constants/search'

type RawResult = Array<{
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
}>

function capitalize (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

function parseFullName (rr: RawResult): string {
  if (rr.keybase && rr.keybase.full_name) {
    return rr.keybase.full_name
  } else if (rr.service && rr.service.full_name) {
    return rr.service.full_name
  }

  return ''
}

function parseExtraInfo (platform: SearchPlatforms, rr: RawResult): ExtraInfo {
  const fullName = parseFullName(rr)
  const serviceName = rr.service && rr.service.service_name && capitalize(rr.service.service_name)

  if (platform === 'Keybase') {
    if (rr.service && serviceName) {
      return {
        service: 'external',
        icon: platformToIcon(serviceName),
        serviceUsername: rr.service.username,
        serviceAvatar: rr.service.picture_url,
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

function rawResults (term: string, platform: SearchPlatforms, rresults: Array<RawResult>) : Results {
  const results: Array<SearchResult> = filterNull(rresults.map(rr => {
    const extraInfo = parseExtraInfo(platform, rr)
    const serviceName = rr.service && rr.service.service_name && capitalize(rr.service.service_name)

    if (platform === 'Keybase') {
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
        username: rr.service.username,
        extraInfo,
      }
    } else {
      return null
    }
  }))

  return {
    type: Constants.results,
    payload: {term, results},
  }
}

export function search (term: string, platform: SearchPlatforms = 'Keybase') : TypedAsyncAction<Search | Results> {
  return dispatch => {
    dispatch({
      type: Constants.search,
      payload: {
        term,
        error: false,
      },
    })

    // TODO daemon rpc, for now api hit
    // const params: UserSearchRpc = {
      // method: 'user.search',
      // param: {
        // query: term
      // },
      // incomingCallMap: {},
      // callback: (error: ?any, uresults: UserSearchResult) => {
        // if (error) {
          // console.log('Error searching. Not handling this error')
        // } else {
          // dispatch(results(term, uresults))
        // }
      // }
    // }

    // engine.rpc(params)
    const service = {
      'Keybase': '',
      'Twitter': 'twitter',
      'Github': 'github',
      'Reddit': 'reddit',
      'Coinbase': 'coinbase',
      'Hackernews': 'hackernews',
      'Pgp': 'pgp',
    }[platform]

    const limit = 20
    fetch(`https://keybase.io/_/api/1.0/user/user_search.json?q=${term}&num_wanted=${limit}&service=${service}`) // eslint-disable-line no-undef
      .then(response => response.json()).then(json => dispatch(rawResults(term, platform, json.list)))
  }
}

export function selectPlatform (platform: SearchPlatforms): SelectPlatform {
  return {
    type: Constants.selectPlatform,
    payload: {platform},
  }
}
