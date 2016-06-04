// @flow
import React, {Component} from 'react'
import {Text} from '../../common-adapters'
import type {Props} from './render'

export default class Render extends Component<void, Props, void> {
  render () {
    return (<Text type='Body'>todo</Text>)
  }
}
