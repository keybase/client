// @flow
import React, {Component} from 'react'
import Box from './box'
import {globalStyles} from '../styles/style-guide'
import type {Props} from './list-item'

export default class ListItem extends Component<void, Props, void> {
  render () {
    const clickable = !!this.props.onClick
    const minHeight = ({'Large': 64, 'Small': 48})[this.props.type]
    return (
      <Box style={{...globalStyles.flexBoxRow, ...containerStyle(this.props.type, clickable), minHeight, ...this.props.containerStyle}}>
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start'}}>
          <Box style={{...globalStyles.flexBoxColumn, ...iconContainerThemed[this.props.type], minHeight, alignItems: 'center', justifyContent: 'center'}}>
            {this.props.icon}
          </Box>
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

function containerStyle (clickable) {
  return clickable ? globalStyles.clickable : {}
}

const iconContainerThemed = {
  'Small': {
    width: 48,
  },
  'Large': {
    width: 64,
  },
}

function actionStyle (extraMargin) {
  return extraMargin ? {marginRight: 32} : {marginRight: 16}
}

const bodyContainerStyle = {
  flex: 2,
  marginLeft: 8,
  marginRight: 16,
  marginBottom: 8,
  marginTop: 8,
  justifyContent: 'center',
}
