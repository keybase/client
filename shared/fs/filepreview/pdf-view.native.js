// @flow
import * as React from 'react'
import {WebView} from '../../common-adapters'
import {globalColors} from '../../styles'
import {type PdfViewProps} from './pdf-view'

const PdfView = ({url, onInvalidToken}: PdfViewProps) => <WebView styles={stylesPdfView} url={url} />

const stylesPdfView = {
  backgroundColor: globalColors.blue5,
}

export default PdfView
