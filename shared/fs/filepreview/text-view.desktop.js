// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {type TextViewProps} from './text-view'

// We need to do the spacing in the guest content of the webView rather than
// the component's styles, to make it feel like the whole "view" is
// scrollable".  The <body> element has the actual content, while <html>
// provides the top and bottom margin that blends with the left and right space
// provided by <FilePreview/>
const webviewCSS = `
html{
  background-color: ${globalColors.blue5};
  padding-top: ${globalMargins.medium}; 
  padding-bottom: ${globalMargins.medium}; 
  margin: 0;
}
body{
  background-color: ${globalColors.white};
  padding: ${globalMargins.xlarge};
  margin: 0;
  color: ${globalColors.black_60};
  line-height: 1.38;
  font-size: 13;
}
`

class TextView extends React.PureComponent<TextViewProps> {
  webviewRef: any

  constructor(props: TextViewProps) {
    super(props)
    this.webviewRef = React.createRef()
  }
  componentDidMount() {
    this.webviewRef.current.addEventListener('dom-ready', () => {
      this.webviewRef.current.insertCSS(webviewCSS)
    })
  }
  render() {
    return <webview ref={this.webviewRef} style={globalStyles.flexGrow} src={this.props.url} />
  }
}

export default TextView
