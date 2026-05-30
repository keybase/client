import type * as React from 'react'
import * as Styles from '@/styles'
import {Box2, ClickableBox3} from './box'
import Text from './text'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'

const Kb = {
  Box2,
  ClickableBox3,
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
  const children = (
    <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true} style={styles.container}>
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
    </Kb.Box2>
  )
  return collapsible ? (
    <Kb.ClickableBox3 onClick={props.onToggleCollapsed} direction="horizontal" fullWidth={true}>
      {children}
    </Kb.ClickableBox3>
  ) : (
    children
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
