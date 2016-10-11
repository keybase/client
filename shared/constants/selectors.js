// @flow
import type {TypedState} from './reducer'

const usernameSelector = ({config: {username}}: TypedState) => username

export {
  usernameSelector,
}
