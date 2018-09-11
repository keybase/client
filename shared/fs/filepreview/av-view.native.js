// @flow
import * as React from 'react'
import {globalColors} from '../../styles'
import {WebView} from '../../common-adapters'
import {type AVViewProps} from './av-view'

const AVView = ({url, onInvalidToken, onLoadingStateChange}: AVViewProps) => (
  <WebView styles={stylesAVView} url={url} onLoadingStateChange={onLoadingStateChange} />
)

const stylesAVView = {
  backgroundColor: globalColors.blue5,
}

export default AVView
