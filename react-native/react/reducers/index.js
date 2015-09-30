'use strict'

import { combineReducers } from 'redux'
import login from './login'
import search from './search'
import profile from './profile'
import tabbedRouter from './tabbed-router.js'

<<<<<<< 1d11adab33c5c7a6d7fcc9cc06b5228ae1810450
export default function (state, action) {
  return combineReducers({
    login,
    tabbedRouter,
    search
  })(state, action)
=======
// combineReducers will give a redbox if it sees a key it's not handling so we have to inject a fake 'search' key handler in there
function dummyReducer (state = {}) {
  return state
}

const combined = combineReducers({
  login,
  tabbedRouter,
  search: dummyReducer,
  profile: dummyReducer
})

export default function (state, action) {
  // search needs access to everything...
  state = combined(state, action)
  state = search(state, action)
  state = profile(state, action)

  return state
>>>>>>> WIP
}
