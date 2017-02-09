// @flow

import {createStore} from 'redux'

const injectReactQueryParams = (url: string): string => {
  if (!__DEV__ || process.env.KEYBASE_DISABLE_REACT_PERF) {
    return url
  }

  return `${url}${url.indexOf('?') === -1 ? '?' : '&'}react_perf`
}

let Reactotron

function startReactotron () {
  if (!__DEV__) {
    return
  }

  Reactotron = require('reactotron-react-js').default
  const reactotronRedux = require('reactotron-redux').reactotronRedux
  const sagaPlugin = require('reactotron-redux-saga')
  Reactotron
    .configure()
    .use(reactotronRedux())
    .use(sagaPlugin())
    .connect()
}

function createWrappedStore () {
  if (!__DEV__) {
    return createStore
  }

  return Reactotron.createStore
}

function createSagaMonitor () {
  if (!__DEV__) {
    return null
  }

  return {sagaMonitor: Reactotron.createSagaMonitor()}
}

export {
  createWrappedStore,
  injectReactQueryParams,
  startReactotron,
  createSagaMonitor,
}
