import React, {Component} from 'react'
import Box from './box'
import {globalStyles, desktopStyles} from '../styles'
import {Props} from './list-item'

class ListItem extends Component<Props> {
  render() {
    const clickable = !!this.props.onClick
    const minHeight = {Large: 56, Small: 40}[this.props.type]
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
              alignItems: 'center',
              height: minHeight,
              justifyContent: 'center',
              width: minHeight,
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
  justifyContent: 'center',
  marginBottom: type === 'Small' ? 4 : 8,
  marginLeft: 8,
  marginRight: 8,
  marginTop: type === 'Small' ? 4 : 8,
})

export default ListItem
