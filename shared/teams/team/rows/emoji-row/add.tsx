import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'
import {useSafeNavigation} from '@/util/safe-navigation'

type OwnProps = {
  teamID: T.Teams.TeamID
  convID: T.Chat.ConversationIDKey
  filter: string
  setFilter: (filter: string) => void
}
const AddEmoji = ({teamID, convID, filter, setFilter}: OwnProps) => {
  const nav = useSafeNavigation()
  const {yourOperations} = useLoadedTeam(teamID)
  const canManageEmoji = yourOperations.manageEmojis
  const onAddEmoji = () =>
    nav.safeNavigateAppend({
      name: 'teamAddEmoji',
      params: {conversationIDKey: convID, teamID},
    })
  const onAddAlias = () =>
    nav.safeNavigateAppend({
      name: 'teamAddEmojiAlias',
      params: {conversationIDKey: convID},
    })
  // clear filter on unmount
  return !canManageEmoji ? null : (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew} justifyContent="space-between">
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.Button
          mode="Secondary"
          label="Add emoji"
          onClick={onAddEmoji}
          small={true}
          style={styles.headerButton}
        />
        <Kb.Button
          mode="Secondary"
          label="Add alias"
          onClick={onAddAlias}
          small={true}
          style={styles.headerButton}
        />
      </Kb.Box2>
      {!Kb.Styles.isMobile && (
        <Kb.SearchFilter
          size="small"
          placeholderText="Filter"
          onChange={setFilter}
          hotkey="k"
          value={filter}
          valueControlled={true}
          style={styles.filterInput}
        />
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  containerNew: {
    ...Kb.Styles.padding(6, Kb.Styles.globalMargins.small),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  filterInput: {
    marginRight: Kb.Styles.globalMargins.tiny,
    maxWidth: 148,
  },
  headerButton: Kb.Styles.platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
}))

export default AddEmoji
