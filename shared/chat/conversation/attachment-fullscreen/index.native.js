// @flow
import React, {Component} from 'react'
import {
  Box,
  Icon,
  Text,
  ProgressIndicator,
  NativeImage,
  ZoomableBox,
} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles, isIPhoneX} from '../../../styles'

import type {Props} from './'

class AutoMaxSizeImage extends Component<any, {width: number, height: number}> {
  state = {height: 0, width: 0}
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

  render() {
    return (
      <ZoomableBox
        contentContainerStyle={{flex: 1, position: 'relative'}}
        maxZoom={10}
        style={{position: 'relative', overflow: 'hidden', width: '100%', height: '100%'}}
      >
        <NativeImage
          {...this.props}
          style={{flex: 1, resizeMode: 'contain', maxHeight: this.state.height, maxWidth: this.state.width}}
        />
      </ZoomableBox>
    )
  }
}

const AttachmentView = ({
  isZoomed,
  onToggleZoom,
  path,
}: {
  isZoomed: boolean,
  onToggleZoom: () => void,
  path: ?string,
}) => (
  <Box style={{...globalStyles.flexBoxCenter, flex: 1}}>
    {!!path && <AutoMaxSizeImage source={{uri: `file://${path}`}} />}
    {!path && <ProgressIndicator style={{width: 48}} white={true} />}
  </Box>
)

const Fullscreen = (props: Props) => {
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
        onClick={props.onClose}
        style={{color: globalColors.white, padding: globalMargins.small}}
      >
        Close
      </Text>
      <AttachmentView isZoomed={props.isZoomed} onToggleZoom={props.onToggleZoom} path={props.path} />
      <Icon
        type="iconfont-ellipsis"
        style={{...styleHeaderFooter, color: globalColors.white}}
        onClick={() => props.onShowMenu(null)}
      />
    </Box>
  )
}

const styleHeaderFooter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 44,
  paddingLeft: globalMargins.small,
}

export default Fullscreen
