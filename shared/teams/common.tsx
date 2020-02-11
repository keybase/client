import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type ActivityLevel = 'active' | 'recently' | 'extinct'
const activityToIcon: {[key in ActivityLevel]: Kb.IconType} = {
  active: 'iconfont-fire',
  extinct: 'iconfont-rip',
  recently: 'iconfont-team-leave',
}
const activityToLabel = {
  active: 'Active',
  extinct: 'Extinct',
  recently: 'Recently active',
}
export const Activity = ({level}: {level: ActivityLevel}) => (
  <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={Styles.isMobile}>
    <Kb.Icon
      type={activityToIcon[level]}
      color={level === 'active' ? Styles.globalColors.greenDark : Styles.globalColors.black_50}
      sizeType="Small"
    />
    <Kb.Text type="BodySmall" style={level === 'active' && styles.activityActive}>
      {activityToLabel[level]}
    </Kb.Text>
  </Kb.Box2>
)

export const ModalTitle = ({children, teamname}: {children: string; teamname: string}) =>
  Styles.isMobile ? (
    <Kb.Box2 direction="vertical" alignItems="center">
      <Kb.Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
        {teamname}
      </Kb.Text>
      <Kb.Text type="BodyBig">{children}</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="center" style={styles.title}>
      <Kb.Avatar size={32} teamname={teamname} style={styles.avatar} />
      <Kb.Box2 direction="vertical" alignItems="center">
        <Kb.Text type="BodySmall" lineClamp={1}>
          {teamname}
        </Kb.Text>
        <Kb.Text type="Header">{children}</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate(() => ({
  activityActive: {
    color: Styles.globalColors.greenDark,
  },
  avatar: Styles.platformStyles({
    isElectron: {
      height: 16,
      position: 'relative',
      top: -16,
    },
  }),
  title: {
    paddingBottom: Styles.globalMargins.tiny,
  },
}))
