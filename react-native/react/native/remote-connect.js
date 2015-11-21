import React, {Component} from '../base-react'
import ipc from 'ipc'

function remoteDispatch (action) {
  if (action.constructor === Function) {
    throw new TypeError("Can't remoteDispatch on a function!")
  }

  // TODO serialize the action with transit so we can support more types
  ipc.send('dispatchAction', action)
}

export default function (mapStateToProps, mapDispatchToProps, mergeProps) {
  // TODO: implement some reasonable state input
  const stateProps = mapStateToProps && mapStateToProps({}) || {}
  const dispatchProps = mapDispatchToProps && mapDispatchToProps(remoteDispatch) || {}

  return ConnectedComponent => {
    class RemoteConnectedComponent extends Component {
      render () {
        const ownProps = this.props
        const props = mergeProps && mergeProps(stateProps, dispatchProps, ownProps) || {
          ...stateProps,
          ...dispatchProps,
          ...ownProps
        }

        console.log('props are: ', props)

        return <ConnectedComponent {...props} />
      }
    }

    return RemoteConnectedComponent
  }
}
