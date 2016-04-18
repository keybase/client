// @flow
import React, {Component} from 'react'
import {TouchableWithoutFeedback} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'
import Box from './box'
import Text from './text'

import type {Props, ItemProps} from './tab-bar'

class TabBarItem extends Component {
  props: ItemProps;

  render () {
    return this.props.children
  }
}

class TabBar extends Component {
  props: Props;
  static Item: Class<TabBarItem>;

  _labels (): Array<React$Element> {
    const tabWidth = this.props.tabWidth || 93

    return (this.props.children || []).map(item => (
      <TouchableWithoutFeedback key={item.props.label} onPress={item.props.onPress}>
        <Box style={{...stylesTab, width: tabWidth}}>
          <Text type='BodySemibold'
            style={{...stylesLabel, color: item.props.selected ? globalColors.black75 : globalColors.black60}}>{item.props.label.toUpperCase()}</Text>
          {item.props.selected && <Box style={stylesSelectedUnderline}/>}
          {!item.props.selected && this.props.underlined && <Box style={stylesUnselectedUnderline}/>}
        </Box>
      </TouchableWithoutFeedback>
    ))
  }

  _content (): any {
    return (this.props.children || []).find(i => i.props.selected)
  }

  render () {
    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        <Box style={{...globalStyles.flexBoxRow}}>
          {this._labels()}
        </Box>
        {this._content()}
      </Box>
    )
  }
}

TabBar.Item = TabBarItem

const stylesContainer = {
  ...globalStyles.flexBoxColumn
}

const stylesTab = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'flex-end'
}

const stylesLabel = {
  fontSize: 14,
  lineHeight: 20,
  marginTop: 5,
  marginBottom: 5
}

const stylesSelectedUnderline = {
  height: 3,
  backgroundColor: globalColors.blue,
  alignSelf: 'stretch'
}

const stylesUnselectedUnderline = {
  height: 2,
  marginTop: 1,
  backgroundColor: globalColors.black10,
  alignSelf: 'stretch'
}

export default TabBar
