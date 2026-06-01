import * as Kb from '@/common-adapters'
import OpenMeta from './openmeta'
import type * as React from 'react'

type Props = {
  isOpen?: boolean
  loading?: boolean
  name: string
  onClick: () => void
  popup: React.ReactNode
  popupAnchor: React.Ref<Kb.MeasureRef>
}

const TeamRow = ({isOpen, loading = false, name, onClick, popup, popupAnchor}: Props) => (
  <Kb.ClickableBox direction="horizontal" fullWidth={true} gap="tiny" style={styles.row} ref={popupAnchor} onClick={onClick}>
    <>
      {popup}
      <Kb.Avatar size={32} teamname={name} isTeam={true} />
    </>
    <Kb.Text type="BodySemiboldLink" lineClamp={1} style={styles.title}>
      {name}
    </Kb.Text>
    {typeof isOpen === 'boolean' && <OpenMeta isOpen={isOpen} />}
    {loading && <Kb.ProgressIndicator style={styles.loading} />}
  </Kb.ClickableBox>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  loading: Kb.Styles.size(16),
  row: {
    alignItems: 'center',
  },
  title: {
    color: Kb.Styles.globalColors.black,
    flexShrink: 1,
  },
}))

export default TeamRow
