import * as C from '@/constants'
import * as Styles from '@/styles'
import {Pressable, Keyboard} from 'react-native'
import Badge from './badge'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import type {Props} from './back-button.shared'
import noop from 'lodash/noop'
import type * as React from 'react'

function BackButton(props: Props) {
  const navigateUp = C.Router2.navigateUp

  if (!Styles.isMobile) {
    const onBack = props.disabled ? noop : props.onClick ?? (() => navigateUp())
    const _onClick = (event: React.BaseSyntheticEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onBack()
    }
    return (
      <div
        style={
          Styles.collapseStyles([
            props.disabled ? styles.disabledContainer : styles.container,
            props.style,
          ]) as React.CSSProperties
        }
        onClick={_onClick}
      >
        <Icon
          type="iconfont-arrow-left"
          style={props.disabled ? styles.disabledIcon : styles.icon}
          color={props.iconColor}
        />
        {props.title !== undefined && !props.hideBackLabel && (
          <Text
            type={props.onClick ? 'BodyPrimaryLink' : 'Body'}
            style={Styles.collapseStyles([props.disabled && styles.disabledText, props.textStyle])}
            onClick={_onClick}
          >
            {props.title || 'Back'}
          </Text>
        )}
      </div>
    )
  }

  const onNavUp = () => {
    Keyboard.dismiss()
    navigateUp()
  }
  const onBack = props.disabled ? noop : (props.onClick ?? onNavUp)
  return (
    <Pressable onPress={onBack} testID="backButton">
      <Box2
        direction="horizontal"
        alignItems="center"
        style={Styles.collapseStyles([styles.container, props.style])}
      >
        <Icon type="iconfont-arrow-left" color={props.iconColor} style={styles.arrow} />
        {!!props.badgeNumber && <Badge badgeNumber={props.badgeNumber} />}
      </Box2>
    </Pressable>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  arrow: {
    marginRight: -3,
    marginTop: 2,
  },
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.desktopStyles.clickable,
      alignItems: 'center',
      zIndex: 1,
    },
    isMobile: {
      marginRight: 8,
      minWidth: 32,
      padding: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  disabledContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      cursor: 'default',
      zIndex: 1,
    },
  }),
  disabledIcon: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
      marginRight: 6,
    },
  }),
  disabledText: Styles.platformStyles({
    isElectron: {cursor: 'default'},
  }),
  icon: {
    marginRight: 6,
  },
}))

export default BackButton
