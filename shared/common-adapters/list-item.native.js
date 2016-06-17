// @flow
import React, {Component} from 'react'
import {TouchableHighlight} from 'react-native'
import Box from './box'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './list-item'

// TODO Add swipe for action
export default class ListItem extends Component<void, Props, void> {
  render () {
    const clickable = !!this.props.onClick
    const height = ({'Large': 64, 'Small': 48})[this.props.type] // minimum height
    const listItem = (
      <Box style={{...globalStyles.flexBoxRow, ...containerStyle(clickable), ...this.props.containerStyle}}>
        <Box style={{height, width: 0}} />
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start'}}>
          <Box style={{...globalStyles.flexBoxColumn, ...iconContainerThemed[this.props.type], height, alignItems: 'center', justifyContent: 'center'}}>
            {this.props.icon}
          </Box>
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, ...bodyContainerStyle(this.props.swipeToAction), ...this.props.bodyContainerStyle}}>
          {this.props.body}
        </Box>
        {!this.props.swipeToAction && (<Box style={{...globalStyles.flexBoxColumn, ...actionStyle(!!this.props.extraRightMarginAction), justifyContent: 'center'}}>
          {this.props.action}
        </Box>)}
      </Box>
    )

    return (
      <TouchableHighlight
        activeOpacity={0.8}
        underlayColor={globalColors.white}
        onPress={this.props.onClick || (() => {})}
        disabled={!(this.props.onClick)}>
        {listItem}
      </TouchableHighlight>

    )
  }
}

function containerStyle (clickable) {
  return {
    ...(clickable ? globalStyles.clickable : {}),
  }
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

function bodyContainerStyle (swipeToAction) {
  return {
    flex: 2,
    marginLeft: 8,
    marginBottom: 8,
    marginTop: 8,
    marginRight: swipeToAction ? 0 : 16,
    justifyContent: 'center',
  }
}
