// @flow
import React, {Component} from 'react'
import Box from './box'
import ClickableBox from './clickable-box'
import {globalStyles} from '../styles'

type Props = {
  type: 'Small' | 'Large',
  icon: React.Node,
  body: React.Node,
  action: React.Node,
  extraRightMarginAction?: boolean, // Spacing is different if the action is just text (for example)
  onClick?: () => void,
  onPress?: void,
  containerStyle?: Object,
  bodyContainerStyle?: Object,
  swipeToAction?: boolean, // Do you have to swipe the list item to reveal an action?
}

// TODO Add swipe for action
class ListItem extends Component<Props> {
  render() {
    const height = {Large: 64, Small: 48}[this.props.type] // minimum height
    const listItem = (
      <Box style={{...globalStyles.flexBoxRow, ...this.props.containerStyle}}>
        <Box style={{height, width: 0}} />
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start'}}>
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              ...iconContainerThemed[this.props.type],
              height,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {this.props.icon}
          </Box>
        </Box>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...bodyContainerStyle(this.props.swipeToAction),
            ...this.props.bodyContainerStyle,
          }}
        >
          {this.props.body}
        </Box>
        {!this.props.swipeToAction && (
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              ...actionStyle(!!this.props.extraRightMarginAction),
              justifyContent: 'center',
            }}
          >
            {this.props.action}
          </Box>
        )}
      </Box>
    )
    return <ClickableBox onClick={this.props.onClick}>{listItem}</ClickableBox>
  }
}

const iconContainerThemed = {
  Small: {
    width: 48,
  },
  Large: {
    width: 64,
  },
}

function actionStyle(extraMargin) {
  return extraMargin ? {marginRight: 32} : {marginRight: 16}
}

function bodyContainerStyle(swipeToAction) {
  return {
    flex: 2,
    marginLeft: 8,
    marginBottom: 8,
    marginTop: 8,
    marginRight: swipeToAction ? 0 : 16,
    justifyContent: 'center',
  }
}

export default ListItem
