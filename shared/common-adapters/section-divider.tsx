import type * as React from 'react'
import * as Styles from '@/styles'
import {Box2, ClickableBox} from './box'
import Text from './text'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'

const Kb = {
  Box2,
  ClickableBox,
  Icon,
  ProgressIndicator,
  Text,
}

type Props = {
  collapsed?: boolean // if set, render the appropriate caret,
  label: string | React.ReactNode
  onToggleCollapsed?: () => void
  showSpinner?: boolean
}

const SectionDivider = (props: Props) => {
  const collapsible = props.collapsed === true || props.collapsed === false
  const boxProps = {
    alignItems: 'center',
    direction: 'horizontal',
    fullWidth: true,
    gap: 'xtiny',
    style: styles.container,
  } as const
  const children = (
    <>
      {typeof props.label === 'string' ? (
        <Kb.Text type="BodySmallSemibold">{props.label}</Kb.Text>
      ) : (
        props.label
      )}
      {collapsible && (
        <Kb.Icon
          sizeType="Tiny"
          style={styles.caret}
          type={props.collapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
        />
      )}
      {props.showSpinner && <Kb.ProgressIndicator style={styles.progress} />}
    </>
  )
  return collapsible ? (
    <Kb.ClickableBox {...boxProps} onClick={props.onToggleCollapsed}>
      {children}
    </Kb.ClickableBox>
  ) : (
    <Kb.Box2 {...boxProps}>{children}</Kb.Box2>
  )
}
const height = isMobile ? 40 : 32
SectionDivider.height = height

const styles = Styles.styleSheetCreate(() => ({
  caret: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
      backgroundColor: Styles.globalColors.blueGrey,
      height,
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.small),
    },
  }),
  progress: {
    ...Styles.size(20),
  },
}))

export default SectionDivider
