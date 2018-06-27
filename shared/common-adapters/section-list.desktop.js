// @flow
import * as React from 'react'
import ReactList from 'react-list'
import type {Props} from './section-list'

export default class extends React.Component<Props> {
  _makeItems = () => {}

  render() {
    const items = this._makeItems()
    return <ReactList {...this.props} />
  }
}
