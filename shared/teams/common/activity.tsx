import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'

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

type ActivityLevels = {
  channels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.ActivityLevel>
  loaded: boolean
  loading: boolean
  reload: () => Promise<void>
  teams: ReadonlyMap<T.Teams.TeamID, T.Teams.ActivityLevel>
}

const ActivityLevelsContext = React.createContext<ActivityLevels | null>(null)

const emptyChannelActivityLevels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.ActivityLevel> = new Map()
const emptyTeamActivityLevels: ReadonlyMap<T.Teams.TeamID, T.Teams.ActivityLevel> = new Map()

const lastActiveStatusToActivityLevel = (status: T.RPCChat.LastActiveStatus): T.Teams.ActivityLevel => {
  switch (status) {
    case T.RPCChat.LastActiveStatus.active:
      return 'active'
    case T.RPCChat.LastActiveStatus.recentlyActive:
      return 'recently'
    case T.RPCChat.LastActiveStatus.none:
    default:
      return 'none'
  }
}

const emptyLoadedActivityLevelsState = (): Omit<ActivityLevels, 'reload'> => ({
  channels: emptyChannelActivityLevels,
  loaded: false,
  loading: false,
  teams: emptyTeamActivityLevels,
})

const useActivityLevelsRaw = (enabled = true): ActivityLevels => {
  const [state, setState] = React.useState<Omit<ActivityLevels, 'reload'>>(emptyLoadedActivityLevelsState)
  const requestVersionRef = React.useRef(0)

  const reload = React.useCallback(async () => {
    if (!enabled) {
      setState(emptyLoadedActivityLevelsState())
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true}))
    try {
      const results = await T.RPCChat.localGetLastActiveForTeamsRpcPromise()
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      const teams = Object.entries(results.teams ?? {}).reduce((res, [teamID, status]) => {
        if (status === T.RPCChat.LastActiveStatus.none) {
          return res
        }
        res.set(teamID, lastActiveStatusToActivityLevel(status))
        return res
      }, new Map<T.Teams.TeamID, T.Teams.ActivityLevel>())
      const channels = Object.entries(results.channels ?? {}).reduce((res, [conversationIDKey, status]) => {
        if (status === T.RPCChat.LastActiveStatus.none) {
          return res
        }
        res.set(conversationIDKey, lastActiveStatusToActivityLevel(status))
        return res
      }, new Map<T.Chat.ConversationIDKey, T.Teams.ActivityLevel>())
      setState({
        channels,
        loaded: true,
        loading: false,
        teams,
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn('Failed to load activity levels', error)
      setState(prev => ({...prev, loading: false}))
    }
  }, [enabled])

  React.useEffect(() => {
    if (enabled) {
      void reload()
    }
  }, [enabled, reload])

  C.Router2.useSafeFocusEffect(() => {
    if (enabled) {
      void reload()
    }
  })

  return {...state, reload}
}

export const ActivityLevelsProvider = (props: React.PropsWithChildren) => {
  const {children} = props
  const value = useActivityLevelsRaw()
  return <ActivityLevelsContext.Provider value={value}>{children}</ActivityLevelsContext.Provider>
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
type ModalTitleProps = MTProps & {newTeamWizard?: T.Teams.NewTeamWizardState}
export const ModalTitle = ({title, teamID, newTeamWizard}: ModalTitleProps) => {
  const {teamMeta} = useLoadedTeam(teamID)
  const teamname = teamMeta.teamname
  const isNewTeamWizard = teamID === T.Teams.newTeamWizardTeamID
  const displayTeamname = isNewTeamWizard ? (newTeamWizard?.name || 'New team') : teamname
  const avatarFilepath = isNewTeamWizard ? newTeamWizard?.avatarFilename : undefined
  const avatarCrop = isNewTeamWizard ? newTeamWizard?.avatarCrop : undefined

  return Kb.Styles.isMobile ? (
    <Kb.Box2 direction="vertical" alignItems="center">
      {!!displayTeamname && (
        <Kb.Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
          {displayTeamname}
        </Kb.Text>
      )}
      <Kb.Text type="BodyBig">{title}</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="center" style={styles.title}>
      <Kb.Avatar
        size={32}
        teamname={displayTeamname === 'New team' ? '' : displayTeamname}
        style={styles.avatar}
        isTeam={true}
        imageOverrideUrl={isNewTeamWizard ? avatarFilepath : undefined}
        crop={isNewTeamWizard ? avatarCrop : undefined}
      />
      <Kb.Box2 direction="vertical" alignItems="center">
        <Kb.Text type="BodySmall" lineClamp={1}>
          {displayTeamname}
        </Kb.Text>
        <Kb.Text type="Header">{title}</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

export const useActivityLevels = (): ActivityLevels => {
  const context = React.useContext(ActivityLevelsContext)
  const raw = useActivityLevelsRaw(!context)
  return context ?? raw
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
