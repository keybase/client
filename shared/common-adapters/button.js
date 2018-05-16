// @flow
import Box from './box'
import ClickableBox from './clickable-box'
import ProgressIndicator from './progress-indicator'
import * as React from 'react'
import Text from './text'
import {
  type StylesCrossPlatform,
  collapseStyles,
  globalColors,
  globalStyles,
  globalMargins,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../styles'

export type Props = {
  children?: React.Node,
  onClick: ?(event: SyntheticEvent<>) => void,
  onPress?: void,
  onMouseEnter?: Function,
  onMouseLeave?: Function,
  label: ?string,
  style?: StylesCrossPlatform,
  labelStyle?: StylesCrossPlatform,
  type:
    | 'Primary'
    | 'PrimaryPrivate'
    | 'Secondary'
    | 'Danger'
    | 'Wallet'
    | 'PrimaryGreen'
    | 'PrimaryGreenActive',
  disabled?: ?boolean,
  waiting?: ?boolean,
  small?: boolean,
  fullWidth?: boolean,
  backgroundMode?: 'Normal' | 'Terminal',
  className?: string,
}

const Progress = ({small, white}) => (
  <Box style={styles.progress}>
    <ProgressIndicator style={progressStyle(small)} white={white} />
  </Box>
)

class Button extends React.Component<Props> {
  render() {
    const backgroundModeName = this.props.backgroundMode
      ? {
          Normal: '',
          Terminal: 'OnTerminal',
        }[this.props.backgroundMode]
      : ''

    let containerStyle = containerStyles[this.props.type + backgroundModeName]
    let labelStyle = labelStyles[this.props.type + 'Label' + backgroundModeName]

    if (this.props.fullWidth) {
      containerStyle = collapseStyles([containerStyle, styles.fullWidth])
    }

    if (this.props.small) {
      containerStyle = collapseStyles([containerStyle, styles.small])
    }

    if (this.props.disabled || this.props.waiting) {
      containerStyle = collapseStyles([containerStyle, styles.opacity30])
    }

    if (!isMobile && this.props.waiting) {
      labelStyle = collapseStyles([labelStyle, styles.opacity0])
    }

    containerStyle = collapseStyles([containerStyle, this.props.style])

    const onClick = (!this.props.disabled && !this.props.waiting && this.props.onClick) || null

    const whiteSpinner = this.props.type !== 'PrimaryGreenActive'

    return (
      <ClickableBox style={containerStyle} onClick={onClick}>
        <Box
          style={collapseStyles([globalStyles.flexBoxRow, globalStyles.flexBoxCenter, styles.labelContainer])}
        >
          {!this.props.waiting && this.props.children}
          {!this.props.waiting && (
            <Text
              type={this.props.small ? 'BodySemibold' : 'BodyBig'}
              style={collapseStyles([labelStyle, this.props.labelStyle])}
            >
              {this.props.label}
            </Text>
          )}
          {this.props.waiting && <Progress small={this.props.small} white={whiteSpinner} />}
        </Box>
      </ClickableBox>
    )
  }
}

const smallHeight = isMobile ? 32 : 28
const regularHeight = isMobile ? 40 : 32
const fullWidthHeight = isMobile ? 48 : 32
const borderRadius = 50
const smallBorderRadius = isMobile ? 50 : 28

const styles = styleSheetCreate({
  common: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius,
      height: regularHeight,
      justifyContent: 'center',
      paddingLeft: globalMargins.medium,
      paddingRight: globalMargins.medium,
    },
    isElectron: {
      display: 'inline-block',
      lineHeight: 'inherit',
    },
  }),
  commonLabel: platformStyles({
    common: {
      color: globalColors.white,
      textAlign: 'center',
    },
    isElectron: {whiteSpace: 'pre'},
  }),
  fullWidth: {
    alignSelf: undefined,
    height: fullWidthHeight,
    width: null,
  },
  labelContainer: {height: '100%', position: 'relative'},
  opacity0: {opacity: 0},
  opacity30: {opacity: 0.3},
  progress: platformStyles({
    isElectron: collapseStyles([globalStyles.fillAbsolute, globalStyles.flexBoxCenter]),
  }),
  small: {
    borderRadius: smallBorderRadius,
    height: smallHeight,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
})

const containerStyles = styleSheetCreate({
  Custom: {},
  Danger: collapseStyles([styles.common, {backgroundColor: globalColors.red}]),
  Primary: collapseStyles([styles.common, {backgroundColor: globalColors.blue}]),
  PrimaryGreen: collapseStyles([styles.common, {backgroundColor: globalColors.green}]),
  PrimaryGreenActive: collapseStyles([
    styles.common,
    platformStyles({
      common: {backgroundColor: globalColors.white, borderColor: globalColors.green, borderWidth: 2},
      isElectron: {borderStyle: 'solid'},
    }),
  ]),
  PrimaryPrivate: collapseStyles([styles.common, {backgroundColor: globalColors.darkBlue2}]),
  Secondary: collapseStyles([styles.common, {backgroundColor: globalColors.lightGrey2}]),
  SecondaryOnTerminal: collapseStyles([styles.common, {backgroundColor: globalColors.blue_30}]),
  Wallet: collapseStyles([styles.common, {backgroundColor: globalColors.purple2}]),
})

const labelStyles = styleSheetCreate({
  CustomLabel: {color: globalColors.black_75, textAlign: 'center'},
  DangerLabel: styles.commonLabel,
  PrimaryGreenActiveLabel: collapseStyles([styles.commonLabel, {color: globalColors.green}]),
  PrimaryGreenLabel: styles.commonLabel,
  PrimaryLabel: styles.commonLabel,
  PrimaryPrivateLabel: styles.commonLabel,
  SecondaryLabel: collapseStyles([styles.commonLabel, {color: globalColors.black_75}]),
  SecondaryLabelOnTerminal: collapseStyles([styles.commonLabel, {color: globalColors.white}]),
  WalletLabel: styles.commonLabel,
})

const progressStyle = small => (isMobile ? undefined : {height: small ? 20 : 20})

export default Button
