import * as Constants from '../constants/search'
import {filterNull} from '../util/arrays'

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

function parseFullName (rr: RawResult): string {
  if (rr.keybase) {
    return rr.keybase.full_name || ''
  } else if (rr.service) {
    return rr.service.full_name || ''
  }

  return ''
}

// TODO(MM) fix type
function parseExtraInfo (platform: SearchPlatforms, rr: RawResult): any /* ExtraInfo */ {
  const fullName = parseFullName(rr)

  if (platform === 'Keybase') {
    // TODO (mm) We don't currently get non keybase extra info when searching in keybase

    return {
      service: 'none',
      fullName,
    }
  }
  if (rr.service) {
  }
}

function rawResults (term: string, platform: SearchPlatforms, rresults: Array<RawResult>) : Results {
  const results: Array<SearchResult> = filterNull(rresults.map(rr => {
    console.log('TODO (MM)', parseExtraInfo(platform, rr))
    if (platform === 'Keybase') {
      if (rr.keybase) {
        return {
          service: 'keybase',
          username: rr.keybase.username,
          isFollowing: rr.keybase.is_followee,
          extraInfo: {
            service: 'none',
            fullName: rr.keybase.full_name,
          },
        }
      } else if (rr.service) {
        return {
          service: 'external',
          icon: rr.service.picture_url,
          username: rr.service.username,
          extraInfo: {
            service: 'external',
            serviceUsername: rr.service.username,
            fullNameOnService: rr.service.full_name,
          },
        }
      }

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
    }[platform]

    console.log(term, platform)
    const limit = 20
    fetch(`https://keybase.io/_/api/1.0/user/user_search.json?q=${term}&num_wanted=${limit}&service=${service}`) // eslint-disable-line no-undef
      .then(response => response.json()).then(json => dispatch(rawResults(term, platform, json.list)))
  }
}
