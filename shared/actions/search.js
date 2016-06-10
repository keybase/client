// @flow
import engine from '../engine'
import * as Constants from '../constants/search'
import type {TypedAsyncAction} from '../constants/types/flux'
import type {Search, Results, SearchResult} from '../constants/search'
import type {UserSearchRpc, UserSearchResult} from '../constants/types/flow-types'

function results (term: string, uresults: UserSearchResult) : Results {
  // TODO map uresults
  const r: Array<SearchResult> = [
  ]

  return {
    type: Constants.results,
    payload: {term, results: r}
  }
}

export function search (term: string) : TypedAsyncAction<Search | Results> {
  return dispatch => {
    dispatch({
      type: Constants.search,
      payload: {
        term,
        error: false
      }
    })

    const params: UserSearchRpc = {
      method: 'user.search',
      param: {
        query: term
      },
      incomingCallMap: {},
      callback: (error: ?any, uresults: UserSearchResult) => {
        if (error) {
          console.log('Error searching. Not handling this error')
        } else {
          dispatch(results(term, uresults))
        }
      }
    }

    engine.rpc(params)
  }
}
