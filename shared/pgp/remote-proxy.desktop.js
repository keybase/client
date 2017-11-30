// @flow
import * as React from 'react'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose} from '../util/container'

const windowOpts = {height: 450, width: 600}

const purgeMapPropsToState = (state: TypedState) => {
  return {
    component: 'purgeMessage',
    selectorParams: '',
    windowOpts,
    windowTitle: 'PgpPurgeMessage',
  }
}

// Actions are handled by remote-container
const RemotePurge = compose(connect(purgeMapPropsToState, () => ({})), SyncBrowserWindow, SyncProps)(<div />)

type Props = {
  show: boolean,
}
class RemotePurges extends React.PureComponent<Props> {
  render() {
    return this.props.show ? <RemotePurge /> : null
  }
}

const mapStateToProps = (state: TypedState) => ({
  show: state.config.pgpPopupOpen,
})

export default connect(mapStateToProps, () => ({}))(RemotePurges)
