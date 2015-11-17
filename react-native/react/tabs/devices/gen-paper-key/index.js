'use strict'

import React, {Component} from '../../../base-react'
import Render from './index.render'
import {generatePaperKey} from '../../../actions/devices'

export default class GenPaperKey extends Component {
  constructor (props) {
    super(props)

    this.state = {
      loading: false
    }
  }
  componentDidMount () {
    if (!this.state.loading && !this.props.paperKey) {
      this.setState({loading: true})
      this.props.dispatch(generatePaperKey())
    }
  }

  render () {
    return (
      <Render
        paperKey={this.props.paperKey}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => {
          const { paperKey } = state.devices

          return {
            paperKey
          }
        }
      }
    }
  }
}

GenPaperKey.propTypes = {
  generatePaperKey: React.PropTypes.func.isRequired,
  dispatch: React.PropTypes.func.isRequired,
  paperKey: React.PropTypes.string
}
