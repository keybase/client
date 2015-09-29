'use strict'

import * as types from '../constants/searchActionTypes'
import { routeAppend, getCurrentURI } from './router'
import engine from '../engine'

export function pushNewSearch () {
  return function (dispatch, getState) {
    dispatch({
      type: types.INIT_SEARCH,
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
      type: types.SEARCH_RUNNING
    })

    engine.rpc('user.search', {query: term}, {}, (error, results) => {
      console.log('search results', results)
      dispatch({
        base,
        type: types.SEARCH_RESULTS,
        results,
        error
      })
    })
  }
}
