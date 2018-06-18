// @flow
import * as React from 'react'
import {Box2, Text, Icon, Input, Button} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../../styles'
import QRImage from './qr-image'

type Mode = 'viewQR' | 'scanQR' | 'enterText' | 'viewText'

type Props = {
  defaultMode: Mode,
  enterQrCodeInstructions: string,
  enterTextCodeInstructions: string,
  viewQrCode: string,
  viewQrCodeInstructions: string,
  viewTextCode: string,
  viewTextCodeInstructions: string,
  onSubmitTextCode: (textCode: string) => void,
}

type State = {
  mode: Mode,
}

const PanelContainer = ({instructions, children}) => (
  <Box2 direction="vertical" style={styles.panelContainer} gap="medium" gapStart={true}>
    <Text type="Body" style={styles.panelInstructions}>
      {instructions}
    </Text>
    {children}
  </Box2>
)

const ViewQR = ({url, instructions}) => (
  <PanelContainer instructions={instructions}>
    <QRImage url={url} />
  </PanelContainer>
)

const ScanQR = () => {
  return <Text type="Body">ScanQR</Text>
}
const ViewText = ({instructions, code}) => (
  <PanelContainer instructions={instructions}>
    <Text type="Terminal" style={styles.textCode}>
      {code}
    </Text>
  </PanelContainer>
)

const EnterText = () => {
  return <Text type="Body">entertext</Text>
}

class CodePage2 extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      mode: this.props.defaultMode,
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.defaultMode !== prevProps.defaultMode) {
      this.setState({
        mode: this.props.defaultMode,
      })
    }
  }

  _tabsMap = {
    scanQR: 'Scan a QR Code',
    viewQR: 'See a QR Code',
    // eslint-disable-next-line sort-keys
    enterText: 'Enter a text code',
    viewText: 'See a text code',
  }

  _getContent = () => {
    switch (this.state.mode) {
      case 'scanQR':
        return <ScanQR />
      case 'viewQR':
        return <ViewQR url={this.props.viewQrCode} instructions={this.props.viewQrCodeInstructions} />
      case 'enterText':
        return <EnterText />
      case 'viewText':
        return <ViewText code={this.props.viewTextCode} instructions={this.props.viewTextCodeInstructions} />
      default:
        return null
    }
  }

  render() {
    return (
      <Box2 direction="vertical">
        <Box2 direction="horizontal" gap="small">
          {Object.keys(this._tabsMap).map(mode => (
            <Text
              key={mode}
              type={mode === this.state.mode ? 'BodySecondaryLink' : 'BodyPrimaryLink'}
              style={styles.tab}
              onClick={() => this.setState({mode})}
            >
              {this._tabsMap[mode]}
            </Text>
          ))}
        </Box2>
        {this._getContent()}
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  panelContainer: {
    alignItems: 'center',
  },
  panelInstructions: {
    maxWidth: 300,
    textAlign: 'center',
  },
  tabs: {
    padding: globalMargins.small,
  },
  textCode: {
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    color: globalColors.darkBlue,
    maxWidth: 300,
    padding: 20,
    textAlign: 'center',
  },
})

export default CodePage2
