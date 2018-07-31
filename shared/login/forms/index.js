// @flow
import * as React from 'react'
import {connect, type TypedState} from '../../util/container'
import Splash from './splash/container'
import Intro from './intro/container'

const mapStateToProps = (state: TypedState) => ({
  showSplash:
    state.config.daemonHandshakeWaiters.size > 0 ||
    (state.config.daemonHandshakeWaiters.size === 0 && state.config.daemonHandshakeFailedReason),
})

const Switcher = ({showSplash, navigateAppend}) =>
  showSplash ? <Splash navigateAppend={navigateAppend} /> : <Intro navigateAppend={navigateAppend} />

export default connect(mapStateToProps)(Switcher)
