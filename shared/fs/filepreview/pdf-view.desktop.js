// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import {type PdfViewProps} from './pdf-view'

const PdfView = (props: PdfViewProps) => (
  <Box style={stylesContainer}>
    <webview style={stylesWebview} src={`chrome://pdf-viewer/index.html?src=${props.url}`} />
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: -globalMargins.medium,
  marginRight: -globalMargins.medium,
}

const stylesWebview = {
  ...globalStyles.flexGrow,
  width: '100%',
}

export default PdfView
