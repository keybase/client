// @flow
import * as React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
import FloatingMenu from './floating-menu'
import Icon from './icon'
import * as Styles from '../styles'
import type {Action, Props} from './header-hoc.types'

const MAX_RIGHT_ACTIONS = 3
type State = {|
  floatingMenuVisible: boolean,
|}
export class HeaderHocHeader extends React.Component<Props, State> {
  state = {
    floatingMenuVisible: false,
  }
  _onHidden = () => this.setState({floatingMenuVisible: false})
  _showFloatingMenu = () => this.setState({floatingMenuVisible: true})
  render() {
    return (
      <Box
        style={Styles.collapseStyles([
          styles.header,
          this.props.borderless && styles.borderless,
          this.props.style,
        ])}
      >
        {this.props.customComponent}
        <Box style={styles.leftAction}>
          {this.props.onLeftAction &&
            (this.props.leftAction === 'cancel' ? (
              <Text type="BodyBigLink" style={styles.action} onClick={this.props.onLeftAction}>
                {this.props.leftActionText || 'Cancel'}
              </Text>
            ) : (
              <BackButton
                badgeNumber={this.props.badgeNumber}
                hideBackLabel={this.props.hideBackLabel}
                iconColor={
                  this.props.theme === 'dark' ? Styles.globalColors.white : Styles.globalColors.black_40
                }
                style={styles.action}
                onClick={this.props.onLeftAction}
              />
            ))}
        </Box>
        <Box
          style={Styles.collapseStyles([
            styles.titleContainer,
            !this.props.rightActions && styles.titlePadding,
          ])}
        >
          {!!this.props.title &&
            !this.props.children && (
              <Text type="BodySemibold" style={styles.title} lineClamp={1}>
                !{this.props.title}
              </Text>
            )}
          {this.props.children}
        </Box>
        <Box
          style={Styles.collapseStyles([
            styles.rightActions,
            this.props.rightActions && Styles.isIOS && styles.rightActionsPadding,
          ])}
        >
          {this.props.rightActions &&
            this.props.rightActions
              .filter(Boolean)
              .slice(
                0,
                this.props.rightActions && this.props.rightActions.length <= MAX_RIGHT_ACTIONS
                  ? MAX_RIGHT_ACTIONS
                  : MAX_RIGHT_ACTIONS - 1
              )
              .map((action, item) => renderAction(action))}
          {this.props.rightActions &&
            this.props.rightActions.length > MAX_RIGHT_ACTIONS && (
              <>
                <Icon
                  fontSize={22}
                  onClick={this._showFloatingMenu}
                  style={styles.action}
                  type="iconfont-ellipsis"
                />
                <FloatingMenu
                  visible={this.state.floatingMenuVisible}
                  items={this.props.rightActions
                    .filter(Boolean)
                    .slice(MAX_RIGHT_ACTIONS - 1)
                    .map((action, item) => ({
                      onClick: action.onPress,
                      title: action.label,
                    }))}
                  onHidden={this._onHidden}
                  position="bottom left"
                  closeOnSelect={true}
                />
              </>
            )}
        </Box>
      </Box>
    )
  }
}

const renderAction = (action: Action): React.Node =>
  action.custom ? (
    <Box style={styles.action}>{action.custom}</Box>
  ) : action.icon ? (
    <Icon fontSize={22} onClick={action.onPress} style={styles.action} type={action.icon} />
  ) : (
    <Text
      type="BodyBigLink"
      style={Styles.collapseStyles([styles.action, action.onPress && styles.actionPressed])}
      onClick={action.onPress}
    >
      {action.label}
    </Text>
  )

function HeaderHoc<P: {}>(WrappedComponent: React.ComponentType<P>) {
  const HeaderHocWrapper = (props: P & Props) => (
    <Box style={styles.container}>
      <HeaderHocHeader {...props} />
      <Box style={styles.wrapper}>
        <Box style={styles.innerWrapper}>
          <WrappedComponent {...(props: P)} />
        </Box>
      </Box>
    </Box>
  )

  return HeaderHocWrapper
}

const styles = Styles.styleSheetCreate({
  action: Styles.platformStyles({
    common: {
      opacity: 1,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isAndroid: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  actionPressed: {
    opacity: 0.3,
  },
  borderless: {
    borderBottomWidth: 0,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  header: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-start',
    minHeight: Styles.globalMargins.xlarge - Styles.statusBarHeight,
    width: '100%',
  },
  innerWrapper: {
    ...Styles.globalStyles.fillAbsolute,
  },
  leftAction: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'flex-start',
      // flex: 1, // still thinking about this
      justifyContent: 'flex-start',
    },
    isIOS: {
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
  rightActions: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-end',
    // flex: 1, // still thinking about this
    justifyContent: 'flex-end',
  },
  rightActionsPadding: {
    paddingRight: Styles.globalMargins.tiny,
  },
  title: {
    color: Styles.globalColors.black_75,
  },
  titleContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      width: '100%',
    },
    isAndroid: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  titlePadding: Styles.platformStyles({
    isMobile: {
      paddingRight: Styles.globalMargins.small,
    },
  }),
  wrapper: {
    flexGrow: 1,
  },
})

export default HeaderHoc
