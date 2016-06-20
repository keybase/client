/* @flow */

import * as Constants from '../constants/search'
import * as CommonConstants from '../constants/common'
import type {Props as IconProps} from '../common-adapters/icon'
import type {SearchResult, SearchActions} from '../constants/search'

type State = {
  searchHintText: string,
  searchText: string,
  searchIcon: IconProps.type,
  results: Array<SearchResult>
}

const initialState: State = {
  searchHintText: '',
  searchText: '',
  searchIcon: 'logo-24',
  results: [],
}

export default function (state: State = initialState, action: SearchActions): State {
  if (action.type === CommonConstants.resetStore) {
    return {...initialState}
  }

  switch (action.type) {
    case Constants.search:
      if (!action.error) {
        return {
          ...state,
          searchText: action.payload.term,
          results: [],
        }
      }
      break
    case Constants.results:
      if (!action.error) {
        if (action.payload.term !== state.searchText) {
          return state
        }

        return {
          ...state,
          results: action.payload.results,
        }
      }
      break
  }

  return state
}
