import React, {Component} from 'react'
import UpdateConfirm from './confirm'
import UpdatePaused from './paused'

export default class Update extends Component {
  render () {
    if (this.props.type === 'confirm') {
      return <UpdateConfirm {...this.props.options} />
    } else if (this.props.type === 'paused') {
      return <UpdatePaused {...this.props.options} />
    } else {
      return <div/>
    }
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Update'}}
  }
}

Update.propTypes = {
  type: React.PropTypes.oneOf(['confirm', 'paused']).isRequired,
  options: React.PropTypes.any
}

export function remoteComponentPropsUpdate (managerProps: Object): Object {
  return {
    component: 'update',
    onRemoteClose: () => managerProps.updateOnCancel(),
    options: {
      onCancel: () => managerProps.updateOnCancel(),
      onSkip: () => managerProps.updateOnSkip(),
      onSnooze: () => managerProps.updateOnSnooze(),
      onUpdate: () => managerProps.updateOnUpdate(),
      setAlwaysUpdate: alwaysUpdate => managerProps.setAlwaysUpdate(alwaysUpdate)
    },
    title: 'Update',
    type: 'confirm',
    waitForState: true,
    windowsOpts: {width: 480, height: 430}
  }
}

export function remoteComponentPropsPaused (managerProps: Object): Object {
  return {
    component: 'update',
    onRemoteClose: () => managerProps.updateOnPauseCancel(),
    title: 'Update',
    waitForState: true,
    windowsOpts: {width: 500, height: 309},
    type: 'paused',
    options: {
      onCancel: () => managerProps.updateOnPauseCancel(),
      onForce: () => managerProps.updateOnForce()
    }
  }
}
