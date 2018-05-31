// @flow
import * as React from 'react'
import {isIOS} from '../constants/platform'
import {WebView} from 'react-native'
import WKWebView from 'react-native-wkwebview-reborn'
import type {WebViewInjections, WebViewProps} from './web-view'
import {memoize} from 'lodash-es'

const escape = (str?: string): string => (str ? str.replace(/\\/g, '\\\\').replace(/`/g, '\\`') : '')

const combineJavaScriptAndCSS = (injections?: WebViewInjections) =>
  !injections
    ? ''
    : `
(function() {
  const style = document.createElement('style')
  document.body.appendChild(style)
  style.type = 'text/css'
  style.appendChild(document.createTextNode(\`${escape(injections.css)}\`))
})()

(function() {\` ${escape(injections.javaScript)} \`})()
`

export default (isIOS
  ? (props: WebViewProps) => (
      <WKWebView
        source={{uri: props.url}}
        injectedJavaScript={memoize(combineJavaScriptAndCSS)(props.injections)}
        style={props.style}
      />
    )
  : (props: WebViewProps) => (
      <WebView
        source={{uri: props.url}}
        injectedJavaScript={memoize(combineJavaScriptAndCSS)(props.injections)}
        style={props.style}
      />
    ))
