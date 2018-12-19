// @flow
import * as React from 'react'
import * as Constants from '../../constants/signup'
import {
  Box2,
  Avatar,
  WaitingButton,
  Input as CommonInput,
  avatarCastPlatformStyles,
  ButtonBar,
  StandardScreen,
} from '../../common-adapters'
import {styleSheetCreate, isMobile, globalMargins} from '../../styles'

type Props = {
  children: React.Node,
  onBack: () => void,
}

export const Wrapper = (props: Props) => (
  <StandardScreen borderless={true} onLeftAction={props.onBack} style={styles.screen}>
    {props.children}
  </StandardScreen>
)

export const BlankAvatar = () => (
  <Avatar username="" size={isMobile ? 96 : 128} style={avatarCastPlatformStyles(styles.avatar)} />
)

export const ContinueButton = ({disabled, onClick}: {disabled?: boolean, onClick: () => void}) => (
  <ButtonBar fullWidth={true} style={styles.buttonBar}>
    <WaitingButton
      waitingKey={Constants.waitingKey}
      type="Primary"
      label="Continue"
      disabled={disabled}
      fullWidth={true}
      onClick={onClick}
    />
  </ButtonBar>
)

export const Input = (props: any) => (
  <Box2 direction="vertical" style={styles.inputContainer}>
    <CommonInput
      style={styles.input}
      inputStyle={styles.inputInnerStyle}
      errorStyle={styles.inputErrorStyle}
      {...props}
    />
  </Box2>
)

export const styles = styleSheetCreate({
  avatar: {marginBottom: isMobile ? globalMargins.xtiny : 0},
  buttonBar: {maxWidth: 460, padding: 0, paddingTop: globalMargins.medium},
  input: {maxWidth: 460, width: '100%'},
  inputContainer: {alignItems: 'center', alignSelf: 'stretch'},
  inputErrorStyle: {minHeight: 0},
  inputInnerStyle: {width: '100%'},
  screen: {alignItems: 'center', paddingTop: globalMargins.medium},
})
