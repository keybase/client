// @flow
import * as React from 'react'
import Box from './box'
import {globalStyles, desktopStyles} from '../styles'

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

class ListItem extends React.Component<Props> {
  render() {
    const clickable = !!this.props.onClick
    const minHeight = {Large: 48, Small: 40}[this.props.type]
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          ...containerStyle(clickable),
          minHeight,
          ...this.props.containerStyle,
        }}
      >
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start'}}>
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              height: minHeight,
              width: minHeight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {this.props.icon}
          </Box>
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, ...bodyContainerStyle(this.props.type)}}>
          {this.props.body}
        </Box>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...actionStyle(!!this.props.extraRightMarginAction),
            justifyContent: 'center',
          }}
        >
          {this.props.action}
        </Box>
      </Box>
    )
  }
}

function containerStyle(clickable) {
  return clickable ? desktopStyles.clickable : {}
}

function actionStyle(extraMargin) {
  return extraMargin ? {marginRight: 32} : {marginRight: 16}
}

const bodyContainerStyle = (type: 'Large' | 'Small') => ({
  flex: 2,
  marginTop: type === 'Small' ? 4 : 8,
  marginBottom: type === 'Small' ? 4 : 8,
  marginLeft: 8,
  marginRight: 8,
  justifyContent: 'center',
})

export default ListItem
