import * as RR from 'react-redux'
import {compose, setDisplayName} from 'recompose'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

// Replaces redux.connect with an implementation that accesses
// custom prop factories in the `store`

// In vanilla connect, this function takes in the map*ToProps functions (via options)
// and composes them to expose output of mergeProps to the component. Here, we ignore
// the maps and just try to access the prop factory closures in the store directly.
const selectorDelegatorFactory = (_, options) => {
  // keep the wrapped displayName for later
  const name = options.wrappedComponentName
  return (state, ownProps) => {
    try {
      // call the factory under the display name to get the view props
      const mapper = state[name]
      if (!mapper) {
        throw new Error('No mock for react state')
      }
      if (typeof mapper === 'function') {
        // replaces what is usually the output of mergeProps
        return mapper(ownProps)
      }
      // allow just a static value
      if (typeof mapper === 'object') {
        return mapper
      }
      throw new Error('Unknown mapper type. Want a function or a plain object')
    } catch (err) {
      throw new Error(
        `Missing mock react state for '${options.wrappedComponentName}':
          Known keys: [${Object.keys(state).join(', ')}]
          Your propProvider is probably missing a key for this connected component. See shared/stories/README.md for more details.

          ${err.toString()}`
      )
    }
  }
}
// define new connect fcn & patch it. See `components/connectAdvanced.js`
// and `connect/selectorFactory.js` in
// https://github.com/reactjs/react-redux/tree/master/src
// for details on the function chain.
const mockConnect = () => RR.connectAdvanced(selectorDelegatorFactory)

const connect = RR.connect

export const namedConnect = (_: any, __: any, ___: any, displayName: string) =>
  compose(
    mockConnect(),
    setDisplayName(displayName)
  )
export default connect
