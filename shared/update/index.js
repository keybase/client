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
      return <div />
    }
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Update'}}
  }
}

Update.propTypes = {
  type: React.PropTypes.oneOf(['confirm', 'paused']).isRequired,
  options: React.PropTypes.any,
}
