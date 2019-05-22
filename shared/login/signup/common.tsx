import * as React from 'react'
import * as Constants from '../../constants/signup'
import {
  Box2,
  Avatar,
  WaitingButton,
  Input as CommonInput,
  avatarCastPlatformStyles,
  ButtonBar,
} from '../../common-adapters'
import {styleSheetCreate, isMobile, globalMargins, globalColors} from '../../styles'

type Props = {
  children: React.ReactNode
  onBack: () => void
}

export const Wrapper = (props: Props) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      centerChildren={true}
      style={styles.wrapper}
      gap={isMobile ? 'xtiny' : 'small'}
    >
      {props.children}
    </Box2>
  </Box2>
)

export const BlankAvatar = () => (
  <Avatar username="" size={isMobile ? 96 : 128} style={avatarCastPlatformStyles(styles.avatar)} />
)

export const ContinueButton = ({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean
  label?: string
  onClick: () => void
}) => (
  <ButtonBar fullWidth={true} style={styles.buttonBar}>
    <WaitingButton
      waitingKey={Constants.waitingKey}
      label={label || 'Continue'}
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
  header: {
    backgroundColor: globalColors.transparent,
    borderBottomWidth: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  input: {maxWidth: 460, width: '100%'},
  inputContainer: {alignItems: 'center', alignSelf: 'stretch'},
  inputErrorStyle: {minHeight: 0},
  inputInnerStyle: {width: '100%'},
  wrapper: {paddingLeft: globalMargins.medium, paddingRight: globalMargins.medium},
})
