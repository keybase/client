// @flow
import React, {Component} from 'react'
import Box from './box'
import {globalStyles} from '../styles/style-guide'
import type {Props} from './list-item'

export default class ListItem extends Component<void, Props, void> {
  render () {
    const clickable = !!this.props.onClick
    return (
      <Box style={{...globalStyles.flexBoxRow, ...containerStyle(this.props.type, clickable), ...this.props.containerStyle}} onClick={this.props.onClick}>
        <Box style={{...globalStyles.flexBoxColumn, ...iconContainerThemed[this.props.type], alignItems: 'center', justifyContent: 'center'}}>
          {this.props.icon}
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, ...bodyContainerStyle}}>
          {this.props.body}
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, ...actionStyle(!!this.props.extraRightMarginAction), justifyContent: 'center'}}>
          {this.props.action}
        </Box>
      </Box>
    )
  }
}

function containerStyle (type, clickable) {
  return {
    minHeight: ({'Large': 64, 'Small': 48})[type],
    ...(clickable ? globalStyles.clickable : {})
  }
}

const iconContainerThemed = {
  'Small': {
    width: 48
  },
  'Large': {
    width: 64
  }
}

function actionStyle (extraMargin) {
  return extraMargin ? {marginRight: 32} : {marginRight: 16}
}

const bodyContainerStyle = {
  flex: 2,
  marginLeft: 8,
  marginRight: 16,
  justifyContent: 'center'
}
