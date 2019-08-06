import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import {Box2} from './box'
import Icon from './icon'
import Button, {Props as ButtonProps} from './button'
import Text from './text'
import Toast from './toast'
import HOCTimers, {PropsWithTimer} from './hoc-timers'
import * as Styles from '../styles'
import {compose, namedConnect} from '../util/container'

type TProps = PropsWithTimer<{
  getAttachmentRef: () => React.Component<any> | null
}>

type TState = {
  showingToast: boolean
}

export class _ToastContainer extends React.Component<TProps, TState> {
  state = {showingToast: false}
  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 1500)
    )
  }

  render() {
    return (
      <Toast position="top center" attachTo={this.props.getAttachmentRef} visible={this.state.showingToast}>
        {Styles.isMobile && <Icon type="iconfont-clipboard" color="white" fontSize={22} />}
        <Text type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySmall'} style={styles.toastText}>
          Copied to clipboard
        </Text>
      </Toast>
    )
  }
}
export const ToastContainer = HOCTimers(_ToastContainer)

type OwnProps = {
  buttonType?: ButtonProps['type']
  containerStyle?: Styles.StylesCrossPlatform
  multiline?: boolean
  onCopy?: () => void
  hideOnCopy?: boolean
  onReveal?: () => void
  withReveal?: boolean
  text: string
}

export type Props = PropsWithTimer<
  {
    copyToClipboard: (arg0: string) => void
  } & OwnProps
>

type State = {
  revealed: boolean
}

class _CopyText extends React.Component<Props, State> {
  state = {revealed: !this.props.withReveal}

  _attachmentRef: Box2 | null = null
  _toastRef: _ToastContainer | null = null
  _textRef: Text | null = null

  copy = () => {
    this._toastRef && this._toastRef.copy()
    this._textRef && this._textRef.highlightText()
    this.props.copyToClipboard(this.props.text)
    this.props.onCopy && this.props.onCopy()
    if (this.props.hideOnCopy) {
      this.setState({revealed: false})
    }
  }

  reveal = () => {
    this.props.onReveal && this.props.onReveal()
    this.setState({revealed: true})
  }

  _isRevealed = () => !this.props.withReveal || this.state.revealed
  _getAttachmentRef = () => this._attachmentRef

  render() {
    const lineClamp = !this.props.multiline && this._isRevealed() ? 1 : null
    return (
      <Box2
        ref={r => (this._attachmentRef = r)}
        direction="horizontal"
        style={Styles.collapseStyles([styles.container, this.props.containerStyle])}
      >
        <ToastContainer ref={(r: any) => (this._toastRef = r)} getAttachmentRef={this._getAttachmentRef} />
        <Text
          lineClamp={lineClamp}
          type="Body"
          selectable={true}
          center={true}
          style={styles.text}
          allowHighlightText={true}
          ref={r => (this._textRef = r)}
        >
          {this._isRevealed() ? this.props.text : '••••••••••••'}
        </Text>
        {!this._isRevealed() && (
          <Text type="BodySmallPrimaryLink" style={styles.reveal} onClick={this.reveal}>
            Reveal
          </Text>
        )}
        {this._isRevealed() && (
          <Button
            type={this.props.buttonType || 'Default'}
            style={styles.button}
            onClick={this.copy}
            labelContainerStyle={styles.buttonLabelContainer}
          >
            <Icon
              type="iconfont-clipboard"
              color={Styles.globalColors.white}
              fontSize={Styles.isMobile ? 20 : 16}
            />
          </Button>
        )}
      </Box2>
    )
  }
}

const mapDispatchToProps = dispatch => ({
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
})

// @ts-ignore HOCTimers typing is wrong
const CopyText: React.ComponentClass<OwnProps> = compose(
  namedConnect(() => ({}), mapDispatchToProps, (s, d, o: OwnProps) => ({...o, ...s, ...d}), 'CopyText'),
  HOCTimers
)(_CopyText)

// border radii aren't literally so big, just sets it to maximum
const styles = Styles.styleSheetCreate({
  button: Styles.platformStyles({
    common: {
      alignSelf: 'stretch',
      height: undefined,
      marginLeft: 'auto',
      minWidth: undefined,
      paddingLeft: 17,
      paddingRight: 17,
    },
    isElectron: {
      display: 'flex',
      paddingBottom: 6,
      paddingTop: 6,
    },
    isMobile: {
      paddingBottom: 10,
      paddingTop: 10,
    },
  }),
  buttonLabelContainer: {
    height: undefined,
  },
  container: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.blueGrey,
      borderRadius: Styles.borderRadius,
      flexGrow: 1,
      position: 'relative',
      width: '100%',
    },
    isElectron: {
      maxWidth: 460,
      overflow: 'hidden',
    },
    isMobile: {
      minHeight: 40,
    },
  }),
  reveal: {
    marginLeft: Styles.globalMargins.tiny,
  },
  text: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.fontTerminalSemibold,
      color: Styles.globalColors.blueDark,
      flexShrink: 1,
      fontSize: Styles.isMobile ? 15 : 13,
      marginBottom: Styles.globalMargins.xsmall / 2,
      marginLeft: Styles.globalMargins.xsmall,
      marginRight: Styles.globalMargins.xsmall,
      marginTop: Styles.globalMargins.xsmall / 2,
      minWidth: 0,
      textAlign: 'left',
    },
    isAndroid: {
      position: 'relative',
      top: 3,
    },
    isElectron: {
      userSelect: 'all',
      wordBreak: 'break-all',
    },
    isMobile: {
      minHeight: 15,
    },
  }),
  toastText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      textAlign: 'center',
    },
    isMobile: {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 5,
    },
  }),
})

export default CopyText
