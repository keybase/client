// @flow
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters/index'
import type {Props} from './popup-menu'
import {globalColors, globalStyles} from '../styles/style-guide'

class Menu extends Component<void, Props, void> {
  render () {
    if (!this.props.visible) {
      return null
    }

    const realCSS = `
    .menu-hover:hover {
      background-color: ${(this.props.style && this.props.style.hoverColor) || globalColors.blue4}
    }
    `

    return (
      <Box style={{...stylesMenuCatcher, ...this.props.style}} onClick={() => this.props.onHidden()}>
        <style>{realCSS}</style>
        <Box style={stylesMenu}>
          {this.props.items.map(i => (
            <Text key={i.title} className='menu-hover' type='Body' style={{...stylesMenuText, ...i.style}} onClick={i.onClick}>{i.title}</Text>
          ))}
        </Box>
      </Box>
    )
  }
}

const stylesMenuCatcher = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0
}

const stylesMenu = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
  borderRadius: 3,
  paddingTop: 7,
  paddingBottom: 7,
  marginTop: 29,
  marginLeft: 4,
  boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.2)'
}

const stylesMenuText = {
  lineHeight: '30px',
  paddingLeft: 15,
  paddingRight: 15
}

export default Menu
