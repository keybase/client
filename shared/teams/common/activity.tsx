import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'

type Props = {title: string; teamname: string; avatarFilepath?: string; avatarCrop?: Types.AvatarCrop}

const activityToIcon: {[key in 'active' | 'recently']: Kb.IconType} = {
  active: 'iconfont-fire',
  recently: 'iconfont-team-leave',
}
const activityToLabel = {
  active: 'Active',
  recently: 'Recently active',
}
const Activity = ({level}: {level: Types.ActivityLevel}) =>
  // @ts-ignore none doesn't exist right now but we can fix this when we start actually plumbing this stuff
  level === 'none' ? null : (
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      alignItems="center"
      fullWidth={Styles.isMobile}
      alignSelf="flex-start"
    >
      <Kb.Icon
        type={activityToIcon[level]}
        color={level === 'active' ? Styles.globalColors.greenDark : Styles.globalColors.black_50}
        sizeType="Small"
      />
      <Kb.Text type="BodySmall" style={level === 'active' ? styles.activityActive : undefined}>
        {activityToLabel[level]}
      </Kb.Text>
    </Kb.Box2>
  )

export const ModalTitle = ({title, teamname, avatarFilepath, avatarCrop}: Props) => {
  return Styles.isMobile ? (
    <Kb.Box2 direction="vertical" alignItems="center">
      <Kb.Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
        {teamname}
      </Kb.Text>
      <Kb.Text type="BodyBig">{title}</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="center" style={styles.title}>
      <Kb.Avatar
        size={32}
        teamname={teamname == 'New team' ? '' : teamname}
        style={styles.avatar}
        isTeam={true}
        imageOverrideUrl={avatarFilepath}
        crop={avatarCrop}
      />
      <Kb.Box2 direction="vertical" alignItems="center">
        <Kb.Text type="BodySmall" lineClamp={1}>
          {teamname}
        </Kb.Text>
        <Kb.Text type="Header">{title}</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

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

export default Activity
