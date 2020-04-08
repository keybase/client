import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'

type Props = {title: string; teamID: Types.TeamID}

const activityToIcon: {[key in 'active' | 'recently']: Kb.IconType} = {
  active: 'iconfont-campfire-burning',
  recently: 'iconfont-campfire-out',
}
const activityToLabel = {
  active: 'Active',
  recently: 'Recently active',
}
const Activity = ({level, style}: {level: Types.ActivityLevel; style?: Styles.StylesCrossPlatform}) =>
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
  const teamname = Container.useSelector(state => Constants.getTeamMeta(state, teamID).teamname)
  const avatarFilepath = Container.useSelector(state => state.teams.newTeamWizard.avatarFilename)
  const avatarCrop = Container.useSelector(state => state.teams.newTeamWizard.avatarCrop)
  const isNewTeamWizard = teamID == Types.newTeamWizardTeamID

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
  const dispatch = Container.useDispatch()
  const activityLevelsLoaded = Container.useSelector(s => s.teams.activityLevels.loaded)
  // keep whether we've triggered a load so we only do it once.
  const triggeredLoad = React.useRef(false)
  React.useEffect(() => {
    if ((!activityLevelsLoaded || forceLoad) && !triggeredLoad.current) {
      dispatch(TeamsGen.createGetActivityForTeams())
      triggeredLoad.current = true
    }
  }, [dispatch, activityLevelsLoaded, forceLoad])
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
