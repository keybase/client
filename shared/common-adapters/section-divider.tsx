import type * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import {Text3} from './text3'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import ClickableBox from './clickable-box'

const Kb = {
  Box2,
  ClickableBox,
  Icon,
  ProgressIndicator,
  Text3,
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
        <Kb.Text3 type="BodySmallSemibold">{props.label}</Kb.Text3>
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
    <Kb.ClickableBox onClick={props.onToggleCollapsed} style={styles.fullWidth}>
      {children}
    </Kb.ClickableBox>
  ) : (
    children
  )
}
const height = Styles.isMobile ? 40 : 32
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
  fullWidth: {
    width: '100%',
  },
  progress: {
    height: 20,
    width: 20,
  },
}))

export default SectionDivider
