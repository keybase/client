// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalColors, globalMargins} from '../../styles'
import {Text} from '../../common-adapters'
import {WebView} from 'react-native'
import type {FilePreviewProps} from './common'

const webviewUrl = url => <WebView source={{uri: url}} style={stylesWebview} />

// TODO: pass here real urls from the HTTP server.
const renderFileTypeSpecial = (props: FilePreviewProps) => {
  switch (Types.getNameExtension(props.pathItem.name).toLowerCase()) {
    case 'txt':
      return webviewUrl('https://keybase.io/warp/release.txt')
    case 'jpg':
    case 'png':
    case 'gif':
      return webviewUrl('https://keybase.io/images/icons/icon-keybase-logo-48.png')
    case 'pdf':
      return webviewUrl('https://tools.ietf.org/pdf/rfc2616.pdf')
  }
  return (
    <Text type="BodySmall" style={stylesNoOpenMobile}>
      This document can not be opened on mobile. You can still interact with it using the menu.
    </Text>
  )
}

const stylesWebview = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
  width: 300,
  height: 500,
}

const stylesNoOpenMobile = {
  marginTop: globalMargins.medium,
  width: 295,
}

export default renderFileTypeSpecial
