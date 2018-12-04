// @flow
import * as React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
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
  onRightAction,
  rightActionLabel,
  theme = 'light',
}: Props) => (
  <Box style={Styles.collapseStyles([styles.header, theme === 'light' ? styles.headerLight : styles.headerDark, headerStyle])}>
    {customComponent}
    {!!title && (
      <Box style={styles.titleContainer}>
        <Text type="BodySmall" style={styles.title}>{title}</Text>
      </Box>
    )}
    {onCancel && (
      <Text type="BodyBigLink" style={styles.button} onClick={onCancel}>
        {customCancelText || 'Cancel'}
      </Text>
    )}
    {onBack && (
      <BackButton
        hideBackLabel={hideBackLabel}
        iconColor={theme === 'light' ? Styles.globalColors.black_40 : Styles.globalColors.white}
        style={styles.button}
        onClick={onBack}
      />
    )}
    {!!rightActionLabel && (
      <Box style={styles.rightAction}>
        <Text
          type="BodyBigLink"
          style={Styles.collapseStyles([styles.button, {opacity: onRightAction ? 1 : 0.3}])}
          onClick={onRightAction}
        >
          {rightActionLabel}
        </Text>
      </Box>
    )}
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
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  innerWrapper: {
    ...Styles.globalStyles.fillAbsolute,
  },
  wrapper: {
    flexGrow: 1,
  },
  button: {
    paddingBottom: 8,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 8,
  },
  header: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-start',
    minHeight: Styles.globalMargins.xlarge - Styles.statusBarHeight,
    paddingRight: Styles.globalMargins.small,
    position: 'relative',
  },
  headerDark: {
    backgroundColor: Styles.globalColors.darkBlue3,
  },
  headerLight: {
    backgroundColor: Styles.globalColors.white,
  },
  rightAction: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-end',
    bottom: 0,
    flex: 1,
    justifyContent: 'flex-end',
    position: 'absolute', // This is always right-aligned
    right: 0,
    top: 0,
  },
  titleContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    bottom: 0,
    flex: 1,
    justifyContent: 'center',
    left: 0,
    position: 'absolute', // This is always centered so we never worry about items to the left/right. If you have overlap or other issues you likely have to fix the content
    right: 0,
    top: 0,
  },
  title: {
    ...Styles.globalStyles.fontSemibold,
    color: Styles.globalColors.black_75,
  },
})

export default HeaderHoc
