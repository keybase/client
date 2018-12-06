// @flow
import * as React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import * as Styles from '../styles'
import type {Props} from './header-hoc.types'

export const HeaderHocHeader = (props: Props) => (
  <Box style={Styles.collapseStyles([styles.header, props.theme === 'light' ? styles.headerLight : styles.headerDark, props.headerStyle])}>
    {props.customComponent}
    {props.onCancel && (
      <Box style={styles.leftAction}>
        <Text type="BodyBigLink" style={styles.action} onClick={props.onCancel}>
          {props.customCancelText || 'Cancel'}
        </Text>
      </Box>
    )}
    {props.onBack && (
      <Box style={styles.leftAction}>
        <BackButton
          hideBackLabel={props.hideBackLabel}
          iconColor={props.theme === 'light' ? Styles.globalColors.black_40 : Styles.globalColors.white}
          style={styles.action}
          onClick={props.onBack}
        />
        {!!props.badgeNumber && <Badge badgeNumber={props.badgeNumber} />}
      </Box>
    )}
    {!!props.title && (
      <Box style={styles.titleContainer}>
        <Text type="BodySmall" style={styles.title} lineClamp={1}>!{props.title}</Text>
      </Box>
    )}
    <Box style={styles.rightAction}>
      {props.rightActions && props.rightActions.filter(Boolean).slice(0, 2).map((action, item) => (
        action.custom
          ? <Box style={styles.action}>
            {action.custom}
            </Box>
          : action.icon
            ? <Icon
                fontSize={22}
                onClick={action.onPress}
                style={styles.action}
                type={action.icon}
              />
            : <Text
                type="BodyBigLink"
                style={Styles.collapseStyles([styles.action, action.onPress && styles.actionPressed])}
                onClick={action.onPress}
              >
                {action.label}
              </Text>
      ))}
    </Box>
  </Box>
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
  action: {
    opacity: 1,
    paddingBottom: 8,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 8,
  },
  actionPressed: {
    opacity: 0.3,
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
  headerDark: {
    backgroundColor: Styles.globalColors.darkBlue3,
  },
  headerLight: {
    backgroundColor: Styles.globalColors.white,
  },
  innerWrapper: {
    ...Styles.globalStyles.fillAbsolute,
  },
  leftAction: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'flex-start',
  },
  rightAction: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-end',
  },
  title: {
    ...Styles.globalStyles.fontSemibold,
    color: Styles.globalColors.black_75,
  },
  titleContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    justifyContent: 'center',
    width: '100%',
  },
  wrapper: {
    flexGrow: 1,
  },
})

export default HeaderHoc
