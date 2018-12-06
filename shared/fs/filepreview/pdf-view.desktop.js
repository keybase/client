// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {type PdfViewProps} from './pdf-view'
import {Box, WebView} from '../../common-adapters'

const PdfView = (props: PdfViewProps) => (
  <Box style={stylesContainer}>
    <WebView style={stylesWebview} url={`chrome://pdf-viewer/index.html?src=${props.url}`} />
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginLeft: -globalMargins.medium,
  marginRight: -globalMargins.medium,
}

const stylesWebview = {
  ...globalStyles.flexGrow,
  width: '100%',
}

export default PdfView
