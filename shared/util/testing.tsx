/* eslint-env jest */
import {createStore, applyMiddleware} from 'redux'
import createSagaMiddleware from 'redux-saga'
import rootReducer from '../reducers'
import {TypedState} from '../constants/reducer'

// See https://github.com/pekala/test-problem-example
export const flushPromises = <T extends {}>(result?: T): Promise<T> =>
  new Promise(resolve => setImmediate(() => resolve(result)))

export const makeStartReduxSaga = (rootSaga: any, initialStore: any, init: (dispatch: any) => void) => {
  return (is?: Object | null) => {
    const sagaMiddleware = createSagaMiddleware({
      onError: e => {
        throw e
      },
    })
    const store = createStore(rootReducer, is || initialStore, applyMiddleware(sagaMiddleware))
    const getState: () => TypedState = store.getState
    const dispatch = store.dispatch
    sagaMiddleware.run(rootSaga)

    init(dispatch)

    return {
      dispatch,
      getState,
    }
  }
}

export const getInitialStore = () => rootReducer(undefined, {type: 'MOCK'})
