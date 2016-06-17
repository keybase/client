// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import RemoteComponent from './remote-component'
import {registerPinentryListener, onCancel, onSubmit} from '../shared/actions/pinentry'
import type {PinentryState} from '../shared/reducers/pinentry'
import type {GUIEntryFeatures} from '../shared/constants/types/flow-types'

type Props = {
  registerPinentryListener: () => void,
  onCancel: (sessionID: number) => void,
  onSubmit: (sessionID: number, passphrase: string, features: GUIEntryFeatures) => void,
  pinentryStates: {[key: string]: PinentryState}
}

class RemotePinentry extends Component<void, Props, void> {
  componentWillMount () {
    this.props.registerPinentryListener()
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.pinentryStates !== this.props.pinentryStates
  }

  render () {
    const {pinentryStates} = this.props

    return (
      <div>
        {Object.keys(pinentryStates).filter(sid => !pinentryStates[sid].closed).map(pSessionID => {
          const sid = parseInt(pSessionID, 10)
          return (
            <RemoteComponent
              title='Pinentry'
              windowsOpts={{width: 500, height: 260}}
              waitForState
              onRemoteClose={() => this.props.onCancel(sid)}
              component='pinentry'
              key={'pinentry:' + pSessionID}
              onSubmit={(passphrase, features) => this.props.onSubmit(sid, passphrase, features)}
              onCancel={() => this.props.onCancel(sid)}
              sessionID={sid} />
          )
        })}
      </div>
    )
  }
}

export default connect(
  state => ({
    pinentryStates: state.pinentry.pinentryStates || {},
  }),
  dispatch => bindActionCreators({
    registerPinentryListener,
    onCancel,
    onSubmit,
  }, dispatch)
)(RemotePinentry)

