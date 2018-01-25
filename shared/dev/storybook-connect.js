// @noflow
// monkey-patch connect
import {connectAdvanced} from 'react-redux'

const _infect = () => {
  const redux = require('react-redux')
  const selectorDelegatorFactory = (dispatch, options) => {
    const name = options.wrappedComponentName
    return (state, ownProps) => {
      return state[name](ownProps)
    }
  }
  const connect = (_, __, ___) => connectAdvanced(selectorDelegatorFactory)
  redux.connect = connect
}

_infect()
