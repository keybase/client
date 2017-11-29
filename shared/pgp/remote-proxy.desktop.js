// @flow
import * as React from 'react'
import RemoteConnector from '../desktop/remote/connector.desktop'
import RemoteWindow from '../desktop/remote/window.desktop'
import {connect, type TypedState, compose} from '../util/container'

const PrintDebug = props => <div style={{wordWrap: 'break-word'}}>{JSON.stringify(props)}</div>

const windowOpts = {height: 450, width: 600}

const purgeMapPropsToState = (state: TypedState) => {
  return {
    component: 'purgeMessage',
    selectorParams: '',
    windowOpts,
    windowTitle: 'PgpPurgeMessage',
  }
}

const RemotePurge = compose(connect(purgeMapPropsToState, () => ({})), RemoteWindow, RemoteConnector)(
  PrintDebug
)

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
