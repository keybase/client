// @noflow
import {connectAdvanced} from 'react-redux'

// Replaces redux.connect with an implementation that accesses
// custom prop factories in the `store`
const _infect = () => {
  const redux = require('react-redux')

  // In vanilla connect, this function takes in the map*ToProps functions (via options)
  // and composes them to expose output of mergeProps to the component. Here, we ignore
  // the maps and just try to access the prop factory closures in the store directly.
  const selectorDelegatorFactory = (dispatch, options) => {
    // keep the wrapped displayName for later
    const name = options.wrappedComponentName
    return (state, ownProps) => {
      try {
        // call the factory under the display name to get the view props
        const viewProps = state[name](ownProps)
        // replaces what is usually the output of mergeProps
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
  // define new connect fcn & patch it. See `components/connectAdvanced.js`
  // and `connect/selectorFactory.js` in
  // https://github.com/reactjs/react-redux/tree/master/src
  // for details on the function chain.
  const connect = (_, __, ___) => connectAdvanced(selectorDelegatorFactory)
  redux.connect = connect
}

_infect()
