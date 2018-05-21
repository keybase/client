// @flow
import * as React from 'react'
import {globalColors} from '../../styles'
import {WebView} from '../../common-adapters'
import {type AVViewProps} from './av-view'

const AVView = ({url, onInvalidToken}: AVViewProps) => <WebView styles={stylesAVView} url={url} />

const stylesAVView = {
  backgroundColor: globalColors.blue5,
}

export default AVView
