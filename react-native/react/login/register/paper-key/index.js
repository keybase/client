import React, {Component} from '../../../base-react'
import {connect} from '../../../base-redux'
import Render from './index.render'

class PaperKey extends Component {
  constructor (props) {
    super(props)

    this.state = {
      paperKey: ''
    }
  }

  render () {
    return (
      <Render
        onSubmit={() => this.props.onSubmit(this.state.paperKey)}
        onChangePaperKey={paperKey => this.setState({paperKey})}
        paperKey={this.state.paperKey}
      />
    )
  }
}

PaperKey.propTypes = {
  onSubmit: React.PropTypes.func.isRequired
}

export default connect(
  state => state,
  null,
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...ownProps,
      ...ownProps.mapStateToProps(stateProps),
      ...dispatchProps
    }
  }
)(PaperKey)
