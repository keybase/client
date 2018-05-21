// @flow
import * as React from 'react'
import {isIOS} from '../constants/platform'
import {WebView} from 'react-native'
import WKWebView from 'react-native-wkwebview-reborn'
import type {WebViewInjections, WebViewProps} from './web-view'
import {memoize} from 'lodash-es'

const wv = isIOS ? WKWebView : WebView

const sanitize = (str?: string): string => (str ? str.replace(/\\/g, '\\\\').replace(/`/g, '\\`') : '')

const combineJavaScriptAndCSS = (injections?: WebViewInjections) =>
  !injections
    ? ''
    : `
(function() {
  const node = document.createElement('style')
  document.body.appendChild(node)
  node.innerHTML = \` ${sanitize(injections.css)} \`
})()

(function() {\` ${sanitize(injections.javaScript)} \`})()
`

export default (props: WebViewProps) => (
  <wv
    source={{uri: props.url}}
    injectedJavaScript={memoize(combineJavaScriptAndCSS)(props.injections)}
    style={props.style}
  />
)
