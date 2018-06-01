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
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../styles'

type Props = PropsWithTimer<{
  containerStyle?: StylesCrossPlatform,
  text: string,
}>

type State = {
  showingToast: boolean,
}

class _CopyText extends React.Component<Props, State> {
  state = {
    showingToast: false,
  }
  _attachmentRef = null

  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 1500)
    )
    copyToClipboard(this.props.text)
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
        <Text type="Body" selectable={true} style={styles.text}>
          {this.props.text}
        </Text>
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
  button: {
    height: '100%',
    paddingLeft: 17,
    paddingRight: 17,
    position: 'absolute',
    right: -20,
  },
  container: {
    alignItems: 'center',
    backgroundColor: globalColors.blue4,
    borderBottomLeftRadius: 100,
    borderTopLeftRadius: 100,
    flex: 1,
    paddingBottom: 6,
    paddingLeft: 16,
    paddingTop: 6,
    position: 'relative',
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
  }),
})

export default CopyText
