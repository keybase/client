import * as React from 'react'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

const activityToIcon: {[key in 'active' | 'recently']: Kb.IconType} = {
  active: 'iconfont-campfire-burning',
  recently: 'iconfont-campfire-out',
}
const activityToLabel = {
  active: 'Active',
  recently: 'Recently active',
}

type Props = {
  level: T.Teams.ActivityLevel
  style?: Kb.Styles.StylesCrossPlatform
  iconOnly?: boolean
}
const Activity = (p: Props) => {
  const {level, style, iconOnly = false} = p
  return level === 'none' ? null : (
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      alignItems="center"
      fullWidth={Kb.Styles.isMobile}
      style={style}
    >
      <Kb.Icon
        type={activityToIcon[level]}
        color={level === 'active' ? Kb.Styles.globalColors.greenDark : Kb.Styles.globalColors.black_50}
        sizeType="Small"
      />
      {iconOnly ? null : (
        <Kb.Text type="BodySmall" style={level === 'active' ? styles.activityActive : undefined}>
          {activityToLabel[level]}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

type MTProps = {title: string; teamID: T.Teams.TeamID}
export const ModalTitle = ({title, teamID}: MTProps) => {
  const teamname = useTeamsState(state => Teams.getTeamMeta(state, teamID).teamname)
  const avatarFilepath = useTeamsState(state => state.newTeamWizard.avatarFilename)
  const avatarCrop = useTeamsState(state => state.newTeamWizard.avatarCrop)
  const isNewTeamWizard = teamID === T.Teams.newTeamWizardTeamID

  return Kb.Styles.isMobile ? (
    <Kb.Box2 direction="vertical" alignItems="center">
      {!!teamname && (
        <Kb.Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
          {teamname}
        </Kb.Text>
      )}
      <Kb.Text type="BodyBig">{title}</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="center" style={styles.title}>
      <Kb.Avatar
        size={32}
        teamname={teamname === 'New team' ? '' : teamname}
        style={styles.avatar}
        isTeam={true}
        imageOverrideUrl={isNewTeamWizard ? avatarFilepath : undefined}
        crop={isNewTeamWizard ? avatarCrop : undefined}
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

/**
 * Ensure activity levels are loaded
 * @param forceLoad force a reload even if they're already loaded.
 */
export const useActivityLevels = (forceLoad?: boolean) => {
  const activityLevelsLoaded = useTeamsState(s => s.activityLevels.loaded)
  const getActivityForTeams = useTeamsState(s => s.dispatch.getActivityForTeams)
  // keep whether we've triggered a load so we only do it once.
  const triggeredLoad = React.useRef(false)
  React.useEffect(() => {
    if ((!activityLevelsLoaded || forceLoad) && !triggeredLoad.current) {
      getActivityForTeams()
      triggeredLoad.current = true
    }
  }, [getActivityForTeams, activityLevelsLoaded, forceLoad])
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  activityActive: {
    color: Kb.Styles.globalColors.greenDark,
  },
  avatar: Kb.Styles.platformStyles({
    isElectron: {
      height: 16,
      position: 'relative',
      top: -16,
    },
  }),
  title: {
    paddingBottom: Kb.Styles.globalMargins.tiny,
  },
}))

export default Activity
