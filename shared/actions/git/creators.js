// @flow
import * as Constants from '../../constants/git'
// import * as RPCTypes from '../../constants/types/flow-types'

function loadGit(): Constants.LoadGit {
  return {
    payload: undefined,
    type: 'git:loadGit',
  }
}

export {loadGit}
