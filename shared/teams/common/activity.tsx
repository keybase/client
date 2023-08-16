import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as T from '../../constants/types'
import * as Constants from '../../constants/teams'

type Props = {title: string; teamID: T.Teams.TeamID}

const activityToIcon: {[key in 'active' | 'recently']: Kb.IconType} = {
  active: 'iconfont-campfire-burning',
  recently: 'iconfont-campfire-out',
}
const activityToLabel = {
  active: 'Active',
  recently: 'Recently active',
}
const Activity = ({level, style}: {level: T.Teams.ActivityLevel; style?: Styles.StylesCrossPlatform}) =>
  level === 'none' ? null : (
    <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={Styles.isMobile} style={style}>
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

export const ModalTitle = ({title, teamID}: Props) => {
  const teamname = C.useTeamsState(state => Constants.getTeamMeta(state, teamID).teamname)
  const avatarFilepath = C.useTeamsState(state => state.newTeamWizard.avatarFilename)
  const avatarCrop = C.useTeamsState(state => state.newTeamWizard.avatarCrop)
  const isNewTeamWizard = teamID == T.Teams.newTeamWizardTeamID

  return Styles.isMobile ? (
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
  const activityLevelsLoaded = C.useTeamsState(s => s.activityLevels.loaded)
  const getActivityForTeams = C.useTeamsState(s => s.dispatch.getActivityForTeams)
  // keep whether we've triggered a load so we only do it once.
  const triggeredLoad = React.useRef(false)
  React.useEffect(() => {
    if ((!activityLevelsLoaded || forceLoad) && !triggeredLoad.current) {
      getActivityForTeams()
      triggeredLoad.current = true
    }
  }, [getActivityForTeams, activityLevelsLoaded, forceLoad])
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
