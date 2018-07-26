// @flow
import React from 'react'
import {
  Box,
  Button,
  MaybePopup,
  Text,
  ButtonBar,
  Icon,
  iconCastPlatformStyles,
} from '../../../../common-adapters'
import HOCTimers, {type PropsWithTimer} from '../../../../common-adapters/hoc-timers'
import Toast from '../../../../common-adapters/toast'
import {globalColors, globalStyles, globalMargins, isMobile, styleSheetCreate} from '../../../../styles'

type Props = PropsWithTimer<{
  name: string,
  onCopyKey: () => void,
  onClose: () => void,
}>

type State = {
  showingToast: boolean,
}

class _RemoveAccountReally extends React.Component<Props, State> {
  state = {
    showingToast: false,
  }
  _attachmentRef = null

  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 2000)
    )
    this.props.onCopyKey()
  }

  render() {
    return (
      <MaybePopup onClose={this.props.onClose}>
        <Box style={styles.box}>
          <Icon
            type={isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
            style={iconCastPlatformStyles(styles.icon)}
          />
          <Text style={styles.warning} type="Header">
            One last thing! Make sure you keep a copy of your secret key before removing{' '}
            <Text type="Header" style={styles.italic}>
              {this.props.name}
            </Text>.
          </Text>
          <Text type="BodySmall">Paste it in a 100% safe place.</Text>
          <ButtonBar style={styles.buttonbar}>
            <Button
              label="Copy secret key"
              onClick={this.copy}
              type="Wallet"
              ref={r => (this._attachmentRef = r)}
            >
              {this.state.showingToast && (
                <Toast
                  visible={this.state.showingToast}
                  attachTo={this._attachmentRef}
                  position={'top center'}
                >
                  <Text type="BodySmall" style={styles.text}>
                    Copied to clipboard
                  </Text>
                </Toast>
              )}
            </Button>
            <Button label="Cancel" onClick={this.props.onClose} type="Secondary" />
          </ButtonBar>
        </Box>
      </MaybePopup>
    )
  }
}
const RemoveAccountReally = HOCTimers(_RemoveAccountReally)

const styles = styleSheetCreate({
  icon: {
    marginBottom: globalMargins.small,
  },
  italic: {
    fontStyle: 'italic',
  },
  box: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    padding: globalMargins.large,
    backgroundColor: globalColors.yellow,
  },
  warning: {
    paddingBottom: globalMargins.medium,
    paddingTop: globalMargins.xtiny,
    textAlign: 'center',
  },
  buttonbar: {
    paddingTop: globalMargins.large,
  },
  text: {
    color: globalColors.white,
  },
  toast: {
    borderRadius: 20,
  },
})

export default RemoveAccountReally
