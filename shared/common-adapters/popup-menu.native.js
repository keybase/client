// @flow
import React, {Component} from 'react'
import {TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import type {DefaultProps, Props, MenuItem} from './popup-menu'
import {Box, Text} from '../common-adapters/index'
import {globalColors, globalMargins, globalStyles} from '../styles/style-guide'

// Menu Item
type MenuItemProps = MenuItem & {
  isHeader?: boolean,
  index: number,
  numItems: number,
}

const MenuRow = (props: MenuItemProps) => (
  <TouchableOpacity activeOpacity={props.onClick ? 0.8 : 1} onPress={props.onClick} style={{...styleRow(props), ...props.style}}>
    <Text type={props.isHeader ? 'BodySmall' : 'Body'} style={styleRowText(props)}>{props.title}</Text>
  </TouchableOpacity>
)

const styleRow = ({isHeader, danger, index, numItems}: {isHeader?: boolean, danger?: boolean, index: number, numItems: number}) => {
  const sharedStyle = {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    ...(index === 0 ? {borderTopLeftRadius: 12, borderTopRightRadius: 12} : {}),
    ...(index === numItems - 1 ? {borderBottomLeftRadius: 12, borderBottomRightRadius: 12} : {}),
  }
  if (isHeader) {
    return {
      ...sharedStyle,
      padding: globalMargins.medium,
      backgroundColor: danger ? globalColors.red : globalColors.blue,
    }
  }
  return {
    ...sharedStyle,
    padding: globalMargins.small,
    backgroundColor: globalColors.white_90,
    ...(index === 0 ? {borderTopWidth: 1} : {}),
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#d7d7d7',
  }
}

const styleRowText = ({isHeader, danger}: {isHeader?: boolean, danger?: boolean}) => {
  const dangerColor = danger ? globalColors.red : globalColors.blue
  const color = isHeader ? globalColors.white : dangerColor
  return {
    color,
    ...(isHeader ? {textAlign: 'center'} : {}),
  }
}

// Popup Menu
class PopupMenu extends Component<DefaultProps, Props, void> {
  static defaultProps: DefaultProps;

  render () {
    if (!this.props.visible) {
      return null
    }
    // $ForceType
    const menuItemsNoDividers: Array<MenuItem> = this.props.items.filter((mi) => mi !== 'Divider')
    const menuItemsWithHeader = [].concat(menuItemsNoDividers)
    if (this.props.header && this.props.header.isMenuItem) {
      menuItemsWithHeader.unshift({...this.props.header, isHeader: true})
    }
    return (
      <TouchableWithoutFeedback style={styleOverlayContainer} onPress={this.props.onHidden}>
        <Box style={styleOverlay}>
          <Box style={{...styleMenu, ...this.props.style}}>
            {!!this.props.header && !this.props.header.isMenuItem && this.props.header}
            <Box style={styleMenuGroup}>
              {menuItemsWithHeader.map((mi, idx) => <MenuRow key={mi.title} {...mi} index={idx} numItems={menuItemsWithHeader.length} />)}
            </Box>
            <Box style={styleMenuGroup}>
              <MenuRow title='Cancel' onClick={this.props.onHidden} index={0} numItems={1} />
            </Box>
          </Box>
        </Box>
      </TouchableWithoutFeedback>
    )
  }
}

PopupMenu.defaultProps = {
  visible: true,
}

const styleOverlayContainer = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
}

const styleOverlay = {
  ...styleOverlayContainer,
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  backgroundColor: globalColors.black_40,
}

const styleMenu = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

const styleMenuGroup = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  marginBottom: globalMargins.tiny,
}

export default PopupMenu
