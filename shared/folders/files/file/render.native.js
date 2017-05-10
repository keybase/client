// @flow
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, Text, Icon, ListItem} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'

class FileRender extends Component<void, Props, void> {
  _renderIconPart() {
    const size = this.props.size === 'Small' ? 32 : 48
    return (
      <Icon type={this.props.fileIcon} style={{height: size, width: size}} />
    )
  }

  _renderBody() {
    return (
      <Box>
        <Text type="BodySemibold" style={filenameStyleThemed[this.props.theme]}>
          {this.props.name}
        </Text>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text type="BodySmall" style={pathStyleThemed[this.props.theme]}>
            {this.props.path}
          </Text>
          {!!this.props.lastModifiedBy &&
            <Box style={{...globalStyles.flexBoxRow}}>
              <Text
                type="BodySmall"
                style={{
                  ...pathStyleThemed[this.props.theme],
                  marginLeft: 4,
                  marginRight: 4,
                }}
              >
                ·
              </Text>
              {this.props.modifiedMarker &&
                <Icon
                  type="iconfont-thunderbolt"
                  style={{
                    fontSize: 10,
                    marginRight: 4,
                    alignSelf: 'center',
                    color: pathStyleThemed[this.props.theme].color,
                  }}
                />}
              <Text
                type="BodySmall"
                style={modifiedByStyleThemed[this.props.theme]}
              >
                {this.props.lastModifiedMeta}
              </Text>
              <Text
                type="BodySmall"
                style={modifiedByStyleThemed[this.props.theme]}
              >
                {' '}by{' '}
              </Text>
              <Text
                type="BodySmallInlineLink"
                style={{
                  ...modifyingUserStyleThemed[this.props.theme],
                  ...(this.props.lastModifiedBySelf ? globalStyles.italic : {}),
                }}
              >
                {this.props.lastModifiedBy}
              </Text>
            </Box>}
        </Box>
      </Box>
    )
  }

  _renderAction() {
    return <Box />
  }

  render() {
    return (
      <ListItem
        type={this.props.size || 'Large'}
        icon={this._renderIconPart()}
        body={this._renderBody()}
        action={this._renderAction()}
        containerStyle={fileContainerStyleThemed[this.props.theme]}
        onClick={this.props.onClick}
      />
    )
  }
}

// TODO make thunderbolt not be an image underneath the hood because we need to change its color

const filenameStyleThemed = {
  public: {
    color: globalColors.yellowGreen2,
  },
  private: {
    color: globalColors.white,
  },
}

const fileContainerStyleThemed = {
  public: {
    backgroundColor: globalColors.white,
  },
  private: {
    backgroundColor: globalColors.darkBlue,
  },
}

const pathStyleThemed = {
  public: {
    color: globalColors.black_40,
  },
  private: {
    color: globalColors.white_40,
  },
}

const modifiedByStyleThemed = {
  public: {
    color: globalColors.black_40,
  },
  private: {
    color: globalColors.white_40,
  },
}

const modifyingUserStyleThemed = {
  public: {
    color: globalColors.black_40,
  },
  private: {
    color: globalColors.white_40,
  },
}

export default FileRender
