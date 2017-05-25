// @flow
import React from 'react'
import RemoteComponentFast from './remote-component-2.desktop'
import {connect} from 'react-redux'
import {registerPinentryListener, onCancel, onSubmit} from '../../actions/pinentry'
import {compose, lifecycle} from 'recompose'

import type {TypedState} from '../../constants/reducer'
// import type {PinentryState} from '../../reducers/pinentry'
import type {GUIEntryFeatures} from '../../constants/types/flow-types'

const RemotePinentry = (props: any) => (
  <div>
    {props.remoteProps.map(p => <RemoteComponentFast key={p.key} {...p} />)}
  </div>
)

// Trying not to touch the store yet so we convert the native thing in the store into something simple over the wire
const mapReduxToSimpleProps = prop => {
  // return {
  // ...prop,
  // id: parse
  // }
  return prop
}

const mapStateToProps = (state: TypedState) => {
  const states = state.pinentry.pinentryStates || {}
  const remoteProps = Object.keys(states).reduce((toSend, key) => {
    const complex = states[key]
    if (complex.closed) {
      return toSend
    }

    toSend.push(mapReduxToSimpleProps(complex))
    return toSend
  }, [])

  return {
    remoteProps,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  onCancel: (sid: number) => dispatch(onCancel(sid)),
  onSubmit: (sid: number, passphrase: string, features: GUIEntryFeatures) =>
    dispatch(onSubmit(sid, passphrase, features)),
  registerPinentryListener: () => dispatch(registerPinentryListener()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  registerPinentryListener: dispatchProps.registerPinentryListener,
  remoteProps: stateProps.remoteProps.map(s => ({
    ...s,
    onCancel: () => dispatchProps.onCancel(s.sessionID),
    onSubmit: (passphrase: string, features: GUIEntryFeatures) =>
      dispatchProps.onSubmit(s.sessionID, passphrase, features),
  })),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount: function() {
      this.props.registerPinentryListener()
    },
  })
)(RemotePinentry)
