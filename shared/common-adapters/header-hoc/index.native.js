// @flow
import * as React from 'react'
import {StyleSheet} from 'react-native'
import Text from '../text'
import BackButton from '../back-button'
import Box from '../box'
import FloatingMenu from '../floating-menu'
import Icon from '../icon'
import * as Styles from '../../styles'
import type {Action, Props} from './index.types'

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
    // TODO: remove these after updates are fully integrated
    const onLeftAction = this.props.onLeftAction || this.props.onBack || this.props.onCancel
    const leftAction = this.props.leftAction || this.props.onCancel ? 'cancel' : this.props.onBack ? 'back' : null
    const rightActions = this.props.rightActions ? this.props.rightActions.filter(Boolean) : (this.props.onRightAction && this.props.rightActionLabel) ? [{
      label: this.props.rightActionLabel,
      onPress: this.props.onRightAction,
    }] : null

    return (
      <Box
        style={Styles.collapseStyles([
          styles.header,
          this.props.borderless && styles.borderless,
          this.props.headerStyle,
        ])}
      >
        {this.props.customComponent}
        <Box style={Styles.collapseStyles([styles.leftAction, this.props.titleComponent && styles.unflex])}>
          {onLeftAction &&
            (leftAction === 'cancel' ? (
              <Text type="BodyBigLink" style={styles.action} onClick={onLeftAction}>
                {this.props.leftActionText || this.props.customCancelText || 'Cancel'}
              </Text>
            ) : (
              <BackButton
                badgeNumber={this.props.badgeNumber}
                hideBackLabel={this.props.hideBackLabel}
                iconColor={
                  this.props.theme === 'dark' ? Styles.globalColors.white : Styles.globalColors.black_40
                }
                style={styles.action}
                onClick={onLeftAction}
              />
            ))}
        </Box>
        <Box
          style={Styles.collapseStyles([
            styles.titleContainer,
            !this.props.rightActions && styles.titlePadding,
          ])}
        >
          {!!this.props.title && !this.props.titleComponent
            ? (<Text type="BodySemibold" style={styles.title} lineClamp={1}>
                {this.props.title}
              </Text>)
            : (this.props.titleComponent)
          }
        </Box>
        <Box style={Styles.collapseStyles([styles.rightActions, this.props.titleComponent && styles.unflex])}>
          <Box style={styles.rightActionsWrapper}>
            {rightActions &&
              rightActions
                .slice(
                  0,
                  rightActions && rightActions.length <= MAX_RIGHT_ACTIONS
                    ? MAX_RIGHT_ACTIONS
                    : MAX_RIGHT_ACTIONS - 1
                )
                .map((action, item) => renderAction(action))}
            {rightActions &&
              rightActions.length > MAX_RIGHT_ACTIONS && (
                <>
                  <Icon
                    fontSize={22}
                    onClick={this._showFloatingMenu}
                    style={styles.action}
                    type="iconfont-ellipsis"
                  />
                  <FloatingMenu
                    visible={this.state.floatingMenuVisible}
                    items={rightActions
                      .slice(MAX_RIGHT_ACTIONS - 1)
                      .map((action, item) => ({
                        onClick: action.onPress,
                        title: action.label || 'You need to specify a label', // TODO: remove this after updates are fully integrated
                      }))}
                    onHidden={this._onHidden}
                    position="bottom left"
                    closeOnSelect={true}
                  />
                </>
              )}
          </Box>
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
      style={Styles.collapseStyles([styles.action, action.onPress && styles.actionPressable])}
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
  actionPressable: {
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
  header: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      justifyContent: 'flex-start',
      width: '100%',
    },
    isAndroid: {
      minHeight: 56,
    },
    isIOS: {
      minHeight: 44,
    },
  }),
  innerWrapper: {
    ...Styles.globalStyles.fillAbsolute,
  },
  leftAction: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'flex-start',
      flexShrink: 1,
      justifyContent: 'flex-start',
    },
    isIOS: {
      flex: 1,
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
  rightActions: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'flex-end',
      flexShrink: 1,
      justifyContent: 'flex-end',
    },
    isIOS: {
      flex: 1,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  rightActionsWrapper: {
    ...Styles.globalStyles.flexBoxRow,
  },
  title: {
    color: Styles.globalColors.black_75,
  },
  titleContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      width: '100%',
    },
    isAndroid: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    isIOS: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  titlePadding: Styles.platformStyles({
    isMobile: {
      paddingRight: Styles.globalMargins.small,
    },
  }),
  unflex: {
    flex: 0,
  },
  wrapper: {
    flexGrow: 1,
  },
})

export default HeaderHoc
