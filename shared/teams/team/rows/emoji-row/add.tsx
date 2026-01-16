import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'

type OwnProps = {
  teamID: T.Teams.TeamID
  convID: T.Chat.ConversationIDKey
  filter: string
  setFilter: (filter: string) => void
}
const AddEmoji = ({teamID, convID, filter, setFilter}: OwnProps) => {
  const nav = useSafeNavigation()
  const canManageEmoji = useTeamsState(s => Teams.getCanPerformByID(s, teamID).manageEmojis)
  const onAddEmoji = () =>
    nav.safeNavigateAppend({
      props: {conversationIDKey: convID, teamID},
      selected: 'teamAddEmoji',
    })
  const onAddAlias = () =>
    nav.safeNavigateAppend({
      props: {conversationIDKey: convID},
      selected: 'teamAddEmojiAlias',
    })
  // clear filter on unmount
  return !canManageEmoji ? null : (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew}>
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
    justifyContent: 'space-between',
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
  text: {padding: Kb.Styles.globalMargins.xtiny},
}))

export default AddEmoji
