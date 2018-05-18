// @flow
import * as React from 'react'
import WebView from '../../common-adapters/web-view.native'
import {globalColors} from '../../styles'
import {type PdfViewProps} from './pdf-view'

const PdfView = ({url, onInvalidToken}: PdfViewProps) => (
  <WebView styles={stylesVideoView} source={{uri: url}} />
)

const stylesVideoView = {
  backgroundColor: globalColors.blue5,
}

export default PdfView
