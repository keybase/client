// @flow
import PurgeMessage from './index.desktop'
import {connect, type Dispatch} from '../util/container'
import * as ConfigGen from '../actions/config-gen'

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClose: () => dispatch(ConfigGen.createPgpAckedMessage()),
})
export default connect(state => state, mapDispatchToProps)(PurgeMessage)
