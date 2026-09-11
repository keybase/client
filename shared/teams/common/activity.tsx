import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import logger from '@/logger'
import {createCachedResourceNamespace, useCachedResource} from '@/util/use-cached-resource'

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
const activityLevelsReloadStaleMs = 5 * 60_000

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

type ActivityLevelsData = Pick<ActivityLevels, 'channels' | 'teams'>

const emptyActivityLevelsData: ActivityLevelsData = {
  channels: emptyChannelActivityLevels,
  teams: emptyTeamActivityLevels,
}
const activityLevelsCacheKey = 'activity' as const

const parseActivityLevels = (
  results: Awaited<ReturnType<typeof T.RPCChat.localGetLastActiveForTeamsRpcPromise>>
): ActivityLevelsData => {
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
  return {
    channels,
    teams,
  }
}

// One entry for the whole app rather than one per provider: the teams root, a
// team, a channel and the add-to-channels modal nest, and each mount used to pay
// its own getLastActiveForTeams. The trade is that a remount inside the stale
// window is served from the entry instead of refetching - activity levels are a
// coarse "how busy is this" bucket, so up to staleMs of drift is acceptable.
const activityLevels = createCachedResourceNamespace<ActivityLevelsData, typeof activityLevelsCacheKey>(
  'teams-activity-levels',
  () => emptyActivityLevelsData
)

const useActivityLevelsRaw = (enabled = true): ActivityLevels => {
  const {data, loaded, loading, reload} = useCachedResource({
    cacheKey: activityLevelsCacheKey,
    enabled,
    initialData: emptyActivityLevelsData,
    load: async () => parseActivityLevels(await T.RPCChat.localGetLastActiveForTeamsRpcPromise()),
    namespace: activityLevels,
    onError: error => {
      logger.warn('Failed to load activity levels', error)
    },
    staleMs: activityLevelsReloadStaleMs,
  })

  return {...data, loaded, loading, reload}
}

export const ActivityLevelsProvider = (props: React.PropsWithChildren) => {
  const {children} = props
  const value = useActivityLevelsRaw()
  return <ActivityLevelsContext.Provider value={value}>{children}</ActivityLevelsContext.Provider>
}

const Activity = (p: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {level, style, iconOnly = false} = p
  return level === 'none' ? null : (
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      alignItems="center"
      // iconOnly renders inline in horizontal rows; fullWidth would starve siblings
      fullWidth={isMobile && !iconOnly}
      style={style}
    >
      <Kb.Icon
        type={activityToIcon[level]}
        color={level === 'active' ? theme.greenDark : theme.black_50}
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

export const useActivityLevels = (): ActivityLevels => {
  const context = React.useContext(ActivityLevelsContext)
  if (!context) {
    throw new Error('useActivityLevels must be used within ActivityLevelsProvider')
  }
  return context
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  activityActive: {
    color: theme.greenDark,
  },
}))

export default Activity
