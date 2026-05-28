import * as Kb from '@/common-adapters'
import type * as React from 'react'

const maxVisibleRows = 3
const teamRowHeight = 40

type Props = {
  children: React.ReactNode
  right?: React.ReactNode
  title: string
}

const TeamSection = ({children, right, title}: Props) => (
  <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
      <Kb.Text type="BodySmallSemibold">{title}</Kb.Text>
      {right}
    </Kb.Box2>
    <Kb.ScrollView style={styles.scroll}>
      <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.scrollContent}>
        {children}
      </Kb.Box2>
    </Kb.ScrollView>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      alignItems: 'flex-start',
      flex: 1,
      flexShrink: 0,
      minWidth: 0,
      paddingBottom: Kb.Styles.globalMargins.small,
      paddingLeft: Kb.Styles.globalMargins.tiny,
    },
  }),
  scroll: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.fullWidth,
      maxHeight: maxVisibleRows * teamRowHeight,
    },
  }),
  scrollContent: Kb.Styles.globalStyles.fullWidth,
}))

export default TeamSection
