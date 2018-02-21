// @flow
import * as React from 'react'
import {List} from '../../common-adapters'
import type {Props} from './list.render'

const styleList = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  display: 'flex',
  alignItems: 'center',
}

export default (props: Props) => <List items={props.rows} style={styleList} renderItem={props.renderRow} />
