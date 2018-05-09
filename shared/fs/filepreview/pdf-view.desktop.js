// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import {type PdfViewProps} from './pdf-view'

class PdfView extends React.PureComponent<PdfViewProps> {
  webviewRef: any

  constructor(props: PdfViewProps) {
    super(props)
    this.webviewRef = React.createRef()
  }
  componentDidMount() {
    this.webviewRef.current.addEventListener('did-get-response-details', ({httpResponseCode}) => {
      httpResponseCode === 403 && this.props.onInvalidToken()
    })
  }
  render() {
    return (
      <Box style={stylesContainer}>
        <webview
          ref={this.webviewRef}
          style={stylesWebview}
          src={`chrome://pdf-viewer/index.html?src=${this.props.url}`}
        />
      </Box>
    )
  }
}

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
