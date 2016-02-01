import React, {Component} from 'react'
import {connect} from 'react-redux'
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

export default connect(
  state => state.update,
    undefined,
    (stateProps, dispatchProps, ownProps) => {
      return {
        ...stateProps,
        ...dispatchProps,
        ...ownProps
      }
    }
)(Update)
