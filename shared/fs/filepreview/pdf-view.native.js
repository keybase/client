// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import WebView from '../../common-adapters/web-view.native'
import {type PdfViewProps} from './pdf-view'

const webviewJS = `window.postMessage({title: document.title})`

const getOnMessage = onInvalidToken => e =>
  e.nativeEvent.data.title === Constants.invalidTokenTitle && onInvalidToken()

const PdfView = ({url, onInvalidToken}: PdfViewProps) => (
  <WebView source={{uri: url}} injectedJavaScript={webviewJS} onMessage={getOnMessage(onInvalidToken)} />
)

export default PdfView
