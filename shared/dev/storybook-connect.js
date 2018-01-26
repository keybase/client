// @noflow
// monkey-patch connect
import {connectAdvanced} from 'react-redux'

const _infect = () => {
  const redux = require('react-redux')
  const selectorDelegatorFactory = (dispatch, options) => {
    const name = options.wrappedComponentName
    return (state, ownProps) => {
      try {
        const viewProps = state[name](ownProps)
        return viewProps
      } catch (err) {
        throw new Error(
          `In calling propSelector for ${options.wrappedComponentName}: 
          Your propProvider is probably missing a key for this connected component. See shared/storybook/README.md for more details.

          ${err.toString()}`
        )
      }
    }
  }
  const connect = (_, __, ___) => connectAdvanced(selectorDelegatorFactory)
  redux.connect = connect
}

_infect()
