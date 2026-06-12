import * as Kb from '@/common-adapters'
import type * as React from 'react'

const SettingsSectionTitle = (p: {
  description?: React.ReactNode
  style?: Kb.Styles.StylesCrossPlatform
  title: string
}) => (
  <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={p.style}>
    <Kb.Text type="Header">{p.title}</Kb.Text>
    {p.description ? <Kb.Text type="BodySmall">{p.description}</Kb.Text> : null}
  </Kb.Box2>
)

export default SettingsSectionTitle
