// @flow
import * as React from 'react'
import {Box2} from './box'
import Button from './button'
import Text from './text'
import Icon from './icon'
import HOCTimers, {type PropsWithTimer} from './hoc-timers'
import Toast from './toast'
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
    showingToast: false,
    revealed: false,
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

  render() {
    return (
      <Box2
        ref={r => (this._attachmentRef = r)}
        direction="horizontal"
        style={collapseStyles([styles.container, this.props.containerStyle])}
      >
        <Toast position="top center" attachTo={this._attachmentRef} visible={this.state.showingToast}>
          {isMobile && <Icon type="iconfont-clipboard" color="white" fontSize={22} />}
          <Text
            type={isMobile ? 'BodySmallSemibold' : 'BodySmall'}
            style={{color: globalColors.white, paddingLeft: 10, paddingRight: 10}}
          >
            Copied to clipboard
          </Text>
        </Toast>
        <Text
          type="Body"
          selectable={true}
          style={collapseStyles([styles.text, !this.state.revealed && {width: 'auto'}])}
        >
          {this.state.revealed ? this.props.text : '••••••••••••'}
        </Text>
        {!this.state.revealed && (
          <Text type="BodyPrimaryLink" style={styles.reveal} onClick={this.reveal}>
            Reveal
          </Text>
        )}
        <Button type="Primary" style={styles.button} onClick={this.copy}>
          <Icon type="iconfont-clipboard" color={globalColors.white} />
        </Button>
      </Box2>
    )
  }
}
const CopyText = HOCTimers(_CopyText)

// border radii aren't literally so big, just sets it to max
// TODO vertical align text center on native
const styles = styleSheetCreate({
  button: platformStyles({
    common: {
      paddingLeft: 17,
      paddingRight: 17,
      position: 'absolute',
      right: 0,
    },
    isElectron: {
      height: '100%',
    },
    isMobile: {
      top: 0,
      bottom: 0,
    },
  }),
  container: platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: globalColors.blue4,
      borderRadius: 100,
      flex: 1,
      paddingLeft: 16,
      position: 'relative',
    },
    isElectron: {
      overflow: 'hidden',
      paddingBottom: 6,
      paddingTop: 6,
      width: '100%',
    },
    isMobile: {
      paddingBottom: 10,
      paddingTop: 10,
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
      width: '100%',
    },
    isElectron: {
      userSelect: 'all',
    },
    isMobile: {
      height: 15,
    },
  }),
})

export default CopyText
