// @flow
import type {TypedState} from './reducer'

const deviceNameSelector = ({config: {extendedConfig}}: TypedState) => extendedConfig && extendedConfig.device && extendedConfig.device.name

const usernameSelector = ({config: {username}}: TypedState) => username

export {
  deviceNameSelector,
  usernameSelector,
}
