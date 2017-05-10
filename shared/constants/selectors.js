// @flow
import type {TypedState} from './reducer'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

export {usernameSelector, loggedInSelector}
