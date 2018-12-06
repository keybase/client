// @flow
import * as React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
import Icon from './icon'
import * as Styles from '../styles'
import type {Props} from './header-hoc.types'

export const HeaderHocHeader = ({
  headerStyle,
  customComponent,
  hideBackLabel,
  title,
  onCancel,
  customCancelText,
  onBack,
  rightActions,
  theme = 'light',
}: Props) => (
  <Box style={Styles.collapseStyles([styles.header, theme === 'light' ? styles.headerLight : styles.headerDark, headerStyle])}>
    {customComponent}
    {onCancel && (
      <Box style={styles.leftAction}>
        <Text type="BodyBigLink" style={styles.action} onClick={onCancel}>
          {customCancelText || 'Cancel'}
        </Text>
      </Box>
    )}
    {onBack && (
      <Box style={styles.leftAction}>
        <BackButton
          hideBackLabel={hideBackLabel}
          iconColor={theme === 'light' ? Styles.globalColors.black_40 : Styles.globalColors.white}
          style={styles.action}
          onClick={onBack}
        />
      </Box>
    )}
    {!!title && (
      <Box style={styles.titleContainer}>
        <Text type="BodySmall" style={styles.title} lineClamp={1}>!{title}</Text>
      </Box>
    )}
    <Box style={styles.rightAction}>
      {rightActions && rightActions.filter(Boolean).slice(0, 2).map((action, item) => {
        return action.custom
          ? <Box style={styles.action}>
            {action.custom}
            </Box>
          : action.label
            ? <Text
                type="BodyBigLink"
                style={Styles.collapseStyles([styles.action, {opacity: action.onPress ? 1 : 0.3}])}
                onClick={action.onPress}
              >
                {action.label}
              </Text>
            : <Icon
                fontSize={22}
                onClick={action.onPress}
                style={styles.action}
                type={`iconfont-${action.icon}`}
              />
      })}
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
    paddingBottom: 8,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 8,
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
