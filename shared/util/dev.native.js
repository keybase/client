// @flow

import {createStore} from 'redux'

function startReactotron () {
  if (!__DEV__) {
    return
  }

  const Reactotron = require('reactotron-react-native').default
  const reactotronRedux = require('reactotron-redux').reactotronRedux
  Reactotron
    .configure()
    .use(reactotronRedux())
    .connect()
}

function createWrappedStore () {
  if (!__DEV__) {
    return createStore
  }

  return require('reactotron-react-js').createStore
}

export {
  createWrappedStore,
  startReactotron,
}
