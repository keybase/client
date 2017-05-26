// @flow
import * as Constants from '../../constants/searchv3'
import * as EntityAction from '../entities'
import {apiserverGetWithSessionRpc} from '../../constants/types/flow-types'
import {trim, keyBy} from 'lodash'
import {call, put, select} from 'redux-saga/effects'
import * as Selectors from '../../constants/selectors'
import * as Saga from '../../util/saga'

import type {SagaGenerator} from '../../constants/types/saga'

function _apiSearch(searchTerm: string, service: string = '', limit: number = 20) {
  return new Promise((resolve, reject) => {
    apiserverGetWithSessionRpc({
      callback: (error, results) => {
        if (error) {
          reject(error)
        } else {
          resolve(results.body)
        }
      },
      param: {
        args: [
          {key: 'q', value: searchTerm},
          {key: 'num_wanted', value: String(limit)},
          {key: 'service', value: service},
        ],
        endpoint: 'user/user_search',
      },
    })
  }).then(JSON.parse)
}

function* search({payload: {term, service, keyPath}}: Constants.Search) {
  try {
    const searchResults = yield call(_apiSearch, trim(term), service)
    const isFollowingFn = yield select(Selectors.isFollowingFnSelector)
    const rows = searchResults.list.map((result: Constants.RawResult) => {
      const isFollowingOnKeybase = !!result.keybase && isFollowingFn(result.keybase.username)
      return Constants.parseRawResultToRow(result, service || 'Keybase', isFollowingOnKeybase)
    })
    // $FlowIssue - cast tuples to array
    yield put(EntityAction.replaceEntity(keyPath, keyBy(rows, 'id')))
  } catch (error) {
    console.warn('error in searching', error)
  }
}

function* searchV3Saga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('searchv3:search', search)
}

export default searchV3Saga
