// @flow
import React, {Component} from 'react'
import {
  Box,
  Icon,
  Text,
  ProgressIndicator,
  NativeImage,
  ZoomableBox,
  NativeDimensions,
} from '../../../common-adapters/native'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../common-adapters/floating-menu'
import MessagePopup from '../messages/message-popup/'
import {globalColors, globalMargins, globalStyles, isIPhoneX} from '../../../styles'

import type {MessageAttachment} from '../../../constants/types/chat2'

type Props = {
  path: string,
  title: string,
  isZoomed: boolean,
  message: MessageAttachment,
  progress: number,
  progressLabel: ?string,
  onClose: () => void,
  onDownloadAttachment: ?() => void,
  onShowInFinder: ?() => void,
  onToggleZoom: () => void,
}

const {width: screenWidth, height: screenHeight} = NativeDimensions.get('window')

class AutoMaxSizeImage extends Component<any, {width: number, height: number, loaded: boolean}> {
  state = {height: 0, width: 0, loaded: false}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    NativeImage.getSize(this.props.source.uri, (width, height) => {
      if (this._mounted) {
        this.setState({height, width})
      }
    })
  }

  _setLoaded = () => this.setState({loaded: true})

  render() {
    return (
      <ZoomableBox
        contentContainerStyle={{flex: 1, position: 'relative'}}
        maxZoom={10}
        style={{position: 'relative', overflow: 'hidden', width: '100%', height: '100%'}}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <NativeImage
          {...this.props}
          resizeMode="contain"
          style={{
            flex: 1,
            height: Math.min(this.state.height, screenHeight),
            width: Math.min(this.state.width, screenWidth),
            alignSelf: 'center',
            opacity: this.props.opacity,
          }}
        />
      </ZoomableBox>
    )
  }
}

class _Fullscreen extends React.Component<Props & FloatingMenuParentProps, {loaded: boolean}> {
  state = {loaded: false}
  _setLoaded = () => this.setState({loaded: true})
  render() {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          ...globalStyles.fillAbsolute,
          backgroundColor: globalColors.black,
          paddingTop: isIPhoneX ? globalMargins.medium : undefined,
        }}
      >
        <Text
          type="Body"
          onClick={this.props.onClose}
          style={{color: globalColors.white, padding: globalMargins.small}}
        >
          Close
        </Text>
        <Box style={{...globalStyles.flexBoxCenter, flex: 1}}>
          {this.props.path && (
            <AutoMaxSizeImage
              source={{uri: `${this.props.path}`}}
              onLoad={this._setLoaded}
              opacity={this.state.loaded ? 1 : 0}
            />
          )}
          {!this.state.loaded && (
            <ProgressIndicator style={{width: 48, position: 'absolute', margin: 'auto'}} white={true} />
          )}
        </Box>
        <Icon
          type="iconfont-ellipsis"
          style={styleHeaderFooter}
          color={globalColors.white}
          onClick={this.props.toggleShowingMenu}
        />
        <MessagePopup
          attachTo={this.props.attachmentRef}
          message={this.props.message}
          onHidden={this.props.toggleShowingMenu}
          position="bottom left"
          visible={this.props.showingMenu}
        />
      </Box>
    )
  }
}
const Fullscreen = FloatingMenuParentHOC(_Fullscreen)

const styleHeaderFooter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 44,
  paddingLeft: globalMargins.small,
}

export default Fullscreen
