import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import UpdateRender from './index.render'

class Update extends Component {
  render () {
    return <UpdateRender {...this.props} />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'update'}}
  }
}

Update.propTypes = UpdateRender.propTypes

export default connect(state => state.update)(Update)
