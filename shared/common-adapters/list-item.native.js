// @flow
import React, {Component} from 'react'
import Box from './box'
import {globalStyles} from '../styles/style-guide'

// TODO Add swipe for action
export default class ListItem extends Component {
  render () {
    const clickable = this.props.clickable === undefined ? true : !!this.props.clickable
    return (
      <Box style={{...globalStyles.flexBoxRow, ...containerStyle(this.props.type, clickable), ...this.props.containerStyle}}>
        <Box style={{...globalStyles.flexBoxColumn, ...iconContainerThemed[this.props.type], alignItems: 'center', justifyContent: 'center'}}>
          {this.props.Icon}
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, ...bodyContainerStyle(this.props.swipeToAction)}}>
          {this.props.Body}
        </Box>
        {!this.props.swipeToAction && (<Box style={{...globalStyles.flexBoxColumn, ...actionStyle[!!this.props.extraRightMarginAction], justifyContent: 'center'}}>
          {this.props.Action}
        </Box>)}
      </Box>
    )
  }
}

function containerStyle (type, clickable) {
  return {
    height: ({'Large': 64, 'Small': 48})[type],
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

const actionStyle = {
  true: {
    marginRight: 32
  },
  false: {
    marginRight: 16
  }
}

function bodyContainerStyle (swipeToAction) {
  return {
    flex: 2,
    marginLeft: 8,
    marginRight: swipeToAction ? 0 : 16,
    justifyContent: 'center'
  }
}
