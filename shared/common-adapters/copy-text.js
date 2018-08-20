// @flow
import * as React from 'react'
import * as Kb from '.'
import Toast from './toast'
import HOCTimers, {type PropsWithTimer} from './hoc-timers'
import {copyToClipboard} from '../util/clipboard'
import {
  collapseStyles,
  type StylesCrossPlatform,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../styles'

type Props = PropsWithTimer<{
  containerStyle?: StylesCrossPlatform,
  withReveal?: boolean,
  text: string,
}>

type State = {
  showingToast: boolean,
  revealed: boolean,
}

class _CopyText extends React.Component<Props, State> {
  state = {
    revealed: false,
    showingToast: false,
  }
  _attachmentRef = null

  componendDidMount() {
    if (!this.props.withReveal) {
      this.setState({revealed: true})
    }
  }

  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 1500)
    )
    copyToClipboard(this.props.text)
  }

  reveal = () => {
    this.setState({revealed: true})
  }

  _isRevealed = () => !this.props.withReveal || this.state.revealed

  render() {
    return (
      <Kb.Box2
        ref={r => (this._attachmentRef = r)}
        direction="horizontal"
        style={collapseStyles([styles.container, this.props.containerStyle])}
      >
        <Toast position="top center" attachTo={this._attachmentRef} visible={this.state.showingToast}>
          {isMobile && <Kb.Icon type="iconfont-clipboard" color="white" fontSize={22} />}
          <Kb.Text type={isMobile ? 'BodySmallSemibold' : 'BodySmall'} style={styles.toastText}>
            Copied to clipboard
          </Kb.Text>
        </Toast>
        <Kb.Text
          lineClamp={1}
          type="Body"
          selectable={true}
          style={collapseStyles([styles.text, !this._isRevealed() && {width: 'auto'}])}
        >
          {this._isRevealed() ? this.props.text : '••••••••••••'}
        </Kb.Text>
        {!this._isRevealed() && (
          <Kb.Text type="BodySmallPrimaryLink" style={styles.reveal} onClick={this.reveal}>
            Reveal
          </Kb.Text>
        )}
        <Kb.ButtonBar direction="row" align="flex-end" style={styles.buttonContainer}>
          <Kb.Button type="Primary" style={styles.button} onClick={this.copy}>
            <Kb.Icon type="iconfont-clipboard" color={globalColors.white} fontSize={isMobile ? 20 : 16} />
          </Kb.Button>
        </Kb.ButtonBar>
      </Kb.Box2>
    )
  }
}
const CopyText = HOCTimers(_CopyText)

// border radii aren't literally so big, just sets it to maximum
const styles = styleSheetCreate({
  buttonContainer: {
    flexGrow: 1,
    minHeight: 0,
    width: 'auto',
  },
  button: platformStyles({
    common: {
      paddingLeft: 17,
      paddingRight: 17,
      height: '100%',
    },
    isElectron: {
      paddingBottom: 6,
      paddingTop: 6,
    },
    isMobile: {
      paddingBottom: 10,
      paddingTop: 10,
    },
  }),
  container: platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: globalColors.blue4,
      borderRadius: 100,
      flexGrow: 1,
      paddingLeft: 16,
      position: 'relative',
    },
    isElectron: {
      maxWidth: 460,
      overflow: 'hidden',
      width: '100%',
    },
    isMobile: {
      height: 40,
    },
  }),
  reveal: {
    marginLeft: globalMargins.tiny,
  },
  text: platformStyles({
    common: {
      ...globalStyles.fontTerminalSemibold,
      color: globalColors.blue,
      fontSize: isMobile ? 15 : 13,
      textAlign: 'left',
    },
    isAndroid: {
      position: 'relative',
      top: 3,
    },
    isElectron: {
      userSelect: 'all',
    },
    isMobile: {
      height: 15,
    },
  }),
  toastText: platformStyles({
    common: {
      color: globalColors.white,
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
