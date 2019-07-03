import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import Box, {Box2} from './box'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import SwitchToggle from './switch-toggle'
import WithTooltip from './with-tooltip'

const Kb = {
  Box,
  Box2,
  ClickableBox,
  ProgressIndicator,
  Text,
  WithTooltip,
}

type Props = {
  align?: 'left' | 'right' | null // default to 'left',
  color?: 'blue' | 'green' | null // default to 'blue',
  disabled?: boolean | null
  gapInBetween?: boolean | null // inserts flex:1 gap between toggle and text,
  gapSize?: number | null // inserts a gap of N pixels between toggle and text
  label: string | React.ReactNode
  labelSubtitle?: string | null // only effective when label is a string,
  labelTooltip?: string | null // only effective when label is a string,
  on: boolean
  onClick: () => void
  style?: Styles.StylesCrossPlatform | null
}

const LabelContainer = props =>
  // We put the tooltip on the whole thing on desktop.
  Styles.isMobile && props.labelTooltip ? (
    <Kb.WithTooltip
      text={props.labelTooltip}
      containerStyle={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.labelContainer])}
      showOnPressMobile={true}
    >
      {props.children}
    </Kb.WithTooltip>
  ) : (
    <Kb.Box2 direction="vertical" style={styles.labelContainer}>
      {props.children}
    </Kb.Box2>
  )

const getContent = (props, ref) => (
  <>
    <Kb.ClickableBox onClick={props.disabled ? undefined : props.onClick} ref={ref}>
      <SwitchToggle
        on={props.on}
        color={props.color || 'blue'}
        style={Styles.collapseStyles([
          props.align === 'left' && styles.switchLeft,
          props.align === 'right' && styles.switchRight,
        ])}
      />
    </Kb.ClickableBox>
    {!!props.gapInBetween && <Kb.Box style={styles.gap} />}
    {!!props.gapSize && <Kb.Box style={{width: props.gapSize}} />}
    {typeof props.label === 'string' ? (
      <LabelContainer {...props}>
        <Kb.Text type="BodySemibold">{props.label}</Kb.Text>
        {!!props.labelSubtitle && <Kb.Text type="BodyTiny">{props.labelSubtitle}</Kb.Text>}
      </LabelContainer>
    ) : (
      props.label
    )}
  </>
)

const getStyle = props =>
  Styles.collapseStyles([
    styles.container,
    props.align !== 'right' ? Styles.globalStyles.flexBoxRow : Styles.globalStyles.flexBoxRowReverse,
    props.disabled && styles.disabled,
    props.style,
  ])

const Switch = React.forwardRef<ClickableBox, Props>((props: Props, ref) =>
  Styles.isMobile || !props.labelTooltip ? (
    <Kb.Box style={getStyle(props)}>{getContent(props, ref)}</Kb.Box>
  ) : (
    <Kb.WithTooltip
      containerStyle={getStyle(props)}
      text={props.labelTooltip || ''}
      position={props.align !== 'right' ? 'top left' : 'top right'}
    >
      {getContent(props, ref)}
    </Kb.WithTooltip>
  )
)

export default Switch

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      alignItems: 'center',
    },
    isElectron: {
      minHeight: 24,
    },
    isMobile: {
      minHeight: 32,
    },
  }),
  disabled: {
    opacity: 0.3,
  },
  gap: {
    flex: 1,
  },
  labelContainer: {
    flexShrink: 1,
  },
  switchLeft: Styles.platformStyles({
    isElectron: {
      marginRight: 10,
    },
    isMobile: {
      marginRight: 12,
    },
  }),
  switchRight: Styles.platformStyles({
    isElectron: {
      marginLeft: 10,
    },
    isMobile: {
      marginLeft: 12,
    },
  }),
})
