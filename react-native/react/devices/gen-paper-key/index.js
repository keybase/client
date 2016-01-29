import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'
import {generatePaperKey} from '../../actions/devices'

class GenPaperKey extends Component {
  constructor (props) {
    super(props)

    this.state = {
      loading: false
    }
  }
  componentDidMount () {
    if (!this.state.loading && !this.props.paperKey) {
      this.setState({loading: true})
      this.props.generatePaperKey()
    }
  }

  render () {
    return (
      <Render
        paperKey={this.props.paperKey}
      />
    )
  }

  static parseRoute () {
    return {componentAtTop: {}}
  }
}

GenPaperKey.propTypes = {
  generatePaperKey: React.PropTypes.func.isRequired,
  paperKey: React.PropTypes.string
}

export default connect(
  state => {
    const {paperKey} = state.devices
    return {paperKey}
  },
  dispatch => {
    return {
      generatePaperKey: () => dispatch(generatePaperKey())
    }
  }
)(GenPaperKey)
