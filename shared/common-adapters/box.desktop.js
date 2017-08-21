// @flow
import React, {Component} from 'react'

export default class Box extends Component<any> {
  render() {
    return <div {...this.props} />
  }
}
