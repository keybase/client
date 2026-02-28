import * as React from 'react'
import * as Styles from '@/styles'
import ClickableBox from './clickable-box'
import Box, {Box2} from './box'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import SwitchToggle from './switch-toggle'
import WithTooltip from './with-tooltip'
import type {MeasureRef} from './measure-ref'
import type {TextType} from './text.shared'

const Kb = {
  Box,
  Box2,
  ClickableBox,
  ProgressIndicator,
  Text,
  WithTooltip,
}

type Props = {
  align?: 'left' | 'right' // default to 'left',
  allowLabelClick?: boolean
  children?: React.ReactNode
  color?: 'blue' | 'green' | 'red' // default to 'blue',
  disabled?: boolean
  gapInBetween?: boolean // inserts flex:1 gap between toggle and text,
  gapSize?: number // inserts a gap of N pixels between toggle and text
  label: string | React.ReactNode
  labelSubtitle?: string // only effective when label is a string,
  labelTooltip?: string // only effective when label is a string,
  labelType?: TextType // only effective when label is a string,
  on: boolean
  onClick: () => void
  style?: Styles.StylesCrossPlatform
}

const LabelContainer = (props: Props) =>
  // We put the tooltip on the whole thing on desktop.
  Styles.isMobile && props.labelTooltip ? (
    <Kb.WithTooltip
      tooltip={props.labelTooltip}
      containerStyle={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.labelContainer])}
      showOnPressMobile={true}
    >
      {props.children}
    </Kb.WithTooltip>
  ) : (
    <Kb.Box2 direction="vertical" style={styles.labelContainer}>
      <Kb.ClickableBox onClick={props.allowLabelClick ? props.onClick : undefined}>
        {props.children}
      </Kb.ClickableBox>
    </Kb.Box2>
  )

const getStyle = (props: Props) =>
  Styles.collapseStyles([
    styles.container,
    props.align !== 'right' ? Styles.globalStyles.flexBoxRow : Styles.globalStyles.flexBoxRowReverse,
    props.style,
  ])

const Switch = React.forwardRef<MeasureRef, Props>(function Switch(props: Props, ref) {
  const content = (
    <>
      <Kb.ClickableBox onClick={props.disabled ? undefined : props.onClick} ref={ref}>
        <SwitchToggle
          on={props.on}
          color={props.color || 'blue'}
          style={Styles.collapseStyles([
            props.align === 'left' && styles.switchLeft,
            props.align === 'right' && styles.switchRight,
            props.disabled && styles.disabled,
            !!props.labelSubtitle && styles.switch,
          ] as const)}
        />
      </Kb.ClickableBox>
      {!!props.gapInBetween && <Kb.Box style={styles.gap} />}
      {!!props.gapSize && <Kb.Box style={{width: props.gapSize}} />}
      {typeof props.label === 'string' ? (
        <LabelContainer {...props}>
          <Kb.Text type={props.labelType ?? 'BodySemibold'}>{props.label}</Kb.Text>
          {!!props.labelSubtitle && <Kb.Text type="BodySmall">{props.labelSubtitle}</Kb.Text>}
        </LabelContainer>
      ) : props.labelSubtitle ? (
        <LabelContainer {...props}>
          {props.label}
          <Kb.Text type="BodySmall">{props.labelSubtitle}</Kb.Text>
        </LabelContainer>
      ) : (
        props.label
      )}
    </>
  )

  return Styles.isMobile || !props.labelTooltip ? (
    <Kb.Box style={getStyle(props)}>{content}</Kb.Box>
  ) : (
    <Kb.WithTooltip
      containerStyle={getStyle(props)}
      tooltip={props.labelTooltip || ''}
      position={props.align !== 'right' ? 'top left' : 'top right'}
    >
      {content}
    </Kb.WithTooltip>
  )
})

export default Switch

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      minHeight: 24,
    },
    isMobile: {
      alignItems: 'flex-start',
      flexShrink: 1,
      minHeight: 32,
    },
  }),
  disabled: {opacity: 0.3},
  gap: {flex: 1},
  labelContainer: {flexShrink: 1},
  switch: Styles.platformStyles({
    isMobile: {
      bottom: Styles.globalMargins.xtiny,
      position: 'relative',
    },
  }),
  switchLeft: Styles.platformStyles({
    isElectron: {marginRight: 10},
    isMobile: {marginRight: 12},
  }),
  switchRight: Styles.platformStyles({
    isElectron: {marginLeft: 10},
    isMobile: {marginLeft: 12},
  }),
}))
