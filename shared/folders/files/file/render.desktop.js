// @flow
import React, {Component} from 'react'
import {Box, Text, Icon, ListItem} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import type {Props} from './render'

export default class Render extends Component<void, Props, void> {
  _renderIconPart () {
    const size = this.props.size === 'Small' ? 32 : 48
    return <Icon type={this.props.fileIcon} style={{height: size, width: size}} />
  }

  _renderBody () {
    return (
      <Box>
        <Text type='BodySmallSemibold' style={filenameStyleThemed[this.props.theme]}>{this.props.name}</Text>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text type='BodySmall' style={pathStyleThemed[this.props.theme]}>{this.props.path}</Text>
          {!!this.props.lastModifiedBy && (<Box style={{display: 'inline'}}>
            <Text type='BodySmallBold' style={{...pathStyleThemed[this.props.theme], marginLeft: 4, marginRight: 4}} inline>·</Text>
            {this.props.modifiedMarker && <Icon type='thunderbolt' style={{height: 12, alignSelf: 'center', marginRight: 6, ...pathStyleThemed[this.props.theme]}} />}
            <Text type='BodySmall' style={modifiedByStyleThemed[this.props.theme]} inline>{this.props.lastModifiedMeta}</Text>
            <Text type='BodySmall' style={modifiedByStyleThemed[this.props.theme]} inline> by </Text>
            <Text type='BodySmallBold' style={{...modifiedByStyleThemed[this.props.theme], ...(this.props.lastModifiedBySelf ? globalStyles.italic : {})}} inline>{this.props.lastModifiedBy}</Text>
          </Box>)}
        </Box>
      </Box>
    )
  }

  _renderAction () {
    return <Box />
  }

  render () {
    return (
      <ListItem
        type={this.props.size || 'Large'}
        icon={this._renderIconPart()}
        body={this._renderBody()}
        action={this._renderAction()}
        containerStyle={fileContainerStyleThemed[this.props.theme]}
        clickable />
    )
  }
}

// TODO make thunderbolt not be an image underneath the hood because we need to change its color

const filenameStyleThemed = {
  'public': {
    color: globalColors.yellowGreen2
  },
  'private': {
    color: globalColors.white
  }
}

const fileContainerStyleThemed = {
  'public': {
  },
  'private': {
    backgroundColor: globalColors.darkBlue
  }
}

const pathStyleThemed = {
  'public': {
    color: globalColors.black_60
  },
  'private': {
    color: globalColors.white_60
  }
}

const modifiedByStyleThemed = {
  'public': {
    color: globalColors.black_40
  },
  'private': {
    color: globalColors.white_40
  }
}
