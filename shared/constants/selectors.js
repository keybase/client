// @flow
import type {TypedState} from './reducer'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

const isFollowingFnSelector = ({config: {followers}}: TypedState) => (username: string) =>
  followers && !!followers[username]

export {usernameSelector, loggedInSelector, isFollowingFnSelector}
