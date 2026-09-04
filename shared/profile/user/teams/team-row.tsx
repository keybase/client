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

const TeamRow = ({isOpen, loading = false, name, onClick, popup, popupAnchor}: Props) => {
  const styles = useStyles()
  // mobile columns are narrow, so an inline OPEN tag eats the name; badge the avatar instead
  const showOpen = isOpen === true
  return (
    <Kb.ClickableBox direction="horizontal" fullWidth={true} gap="tiny" style={styles.row} ref={popupAnchor} onClick={onClick}>
      <>
        {popup}
        <Kb.Box2 direction="vertical" relative={true} style={styles.avatar}>
          <Kb.Avatar size={32} teamname={name} isTeam={true} />
          {showOpen && isMobile && (
            <Kb.Box2 direction="vertical" alignItems="center" style={styles.openBadge} pointerEvents="none">
              <Kb.Meta variant="open" size="Small" />
            </Kb.Box2>
          )}
        </Kb.Box2>
      </>
      <Kb.Text type="BodySemiboldLink" lineClamp={1} style={styles.title}>
        {name}
      </Kb.Text>
      {!isMobile && typeof isOpen === 'boolean' && <OpenMeta isOpen={isOpen} />}
      {loading && <Kb.ProgressIndicator style={styles.loading} />}
    </Kb.ClickableBox>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  avatar: {flexShrink: 0, ...Kb.Styles.size(32)},
  loading: Kb.Styles.size(16),
  openBadge: {
    bottom: -2,
    left: -8,
    position: 'absolute',
    right: -8,
  },
  row: {
    alignItems: 'center',
  },
  title: {
    color: theme.black,
    flexShrink: 1,
  },
}))

export default TeamRow
