// @flow
import * as Constants from '../../constants/searchv3'

function search(
  term: string,
  keyPath: Constants.KeyPath,
  service: Constants.SearchPlatform = 'Keybase'
): Constants.Search {
  return {type: 'searchv3:search', payload: {keyPath, term, service}}
}

function onShowTracker(keyPath: Constants.KeyPath, resultId: string): Constants.OnShowTracker {
  return {type: 'searchv3:onShowTracker', payload: {keyPath, resultId}}
}

export {search, onShowTracker}
