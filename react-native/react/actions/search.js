'use strict'

import { INIT_SEARCH, SEARCH_RUNNING, SEARCH_RESULTS } from '../constants/searchActionTypes'
import { routeAppend, getCurrentURI } from './router'
import engine from '../engine'

export function pushNewSearch () {
  return function (dispatch, getState) {
    dispatch({
      type: INIT_SEARCH,
      base: getCurrentURI(getState())
    })
    dispatch(routeAppend('search'))
  }
}

export function submitSearch (base, term) {
  return function (dispatch) {
    dispatch({
      base,
      term,
      type: SEARCH_RUNNING
    })

    engine.rpc('user.search', {query: term}, {}, (error, results) => {
      console.log('search results', results)
      dispatch({
        base,
        type: SEARCH_RESULTS,
        results,
        error
      })
    })
  }
}
