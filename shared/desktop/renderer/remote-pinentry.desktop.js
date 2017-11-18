// @flow
import * as React from 'react'
import RemoteConnector from './remote-connector'
import RemoteWindow from './remote-window'
import {connect, type TypedState, compose, type Dispatch} from '../../util/container'
// import {onCancel, onSubmit} from '../../actions/pinentry'
import {type PinentryState} from '../../constants/types/pinentry'
import {type GUIEntryFeatures} from '../../constants/types/flow-types'

type Props = {
  registerPinentryListener: () => void,
  onCancel: (sessionID: number) => void,
  onSubmit: (sessionID: number, passphrase: string, features: GUIEntryFeatures) => void,
  pinentryStates: {[key: string]: PinentryState},
}

const windowOpts = {height: 210, width: 440}

const pinentryMapStateToProps = (state: TypedState, {id}) => ({
  component: 'pinentry',
  selectorParams: String(id),
  sessionID: id,
  title: 'Pinentry',
  windowOpts,
})
const pinentryMapDispatchToProps = (dispatch: Dispatch, {id}) => ({})

// TODO remoteconnector sends all props over the wire and handles the callbacks
// connect above ha to set some remot eid or osmething
const PrintDebug = props => <div>{JSON.stringify(props)}</div>
const RemotePinentry = compose(
  connect(pinentryMapStateToProps, pinentryMapDispatchToProps),
  RemoteWindow,
  RemoteConnector
)(PrintDebug)

class RemotePinentrys extends React.PureComponent<Props> {
  render() {
    return (
      <div>
        {this.props.pinentryIDs.map(id => <RemotePinentry id={id} key={id} />)}
        {/*
          <RemoteConnector
            title="Pinentry"
            windowsOpts={{width: 440, height: 210}}
            onRemoteClose={() => this.props.onCancel(id)}
            component="pinentry"
            key={'pinentry:' + String(id)}
            onSubmit={(passphrase, features) => this.props.onSubmit(id, passphrase, features)}
            onCancel={() => this.props.onCancel(id)}
            sessionID={id}
          />
        )) */}
      </div>
    )
  }
}

const mapStateToProps = (state: TypedState) => ({
  pinentryIDs: Object.keys(state.pinentry.pinentryStates).map(s => parseInt(s, 10)),
})

const mapDispatchToprops = (dispatch: any, ownProps: {}) => ({
  // onCancel: (sid: number) => dispatch(onCancel(sid)),
  // onSubmit: (sid: number, passphrase: string, features: GUIEntryFeatures) =>
  // dispatch(onSubmit(sid, passphrase, features)),
})

export default connect(mapStateToProps, mapDispatchToprops)(RemotePinentrys)
