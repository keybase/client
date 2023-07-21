import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/teams'
import * as Constants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import type * as ChatTypes from '../../../../constants/types/chat2'

type OwnProps = {
  teamID: Types.TeamID
  convID: ChatTypes.ConversationIDKey
  filter: string
  setFilter: (filter: string) => void
}
const AddEmoji = ({teamID, convID, filter, setFilter}: OwnProps) => {
  const nav = Container.useSafeNavigation()
  const canManageEmoji = Constants.useState(s => Constants.getCanPerformByID(s, teamID).manageEmojis)
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
      {!Styles.isMobile && (
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

const styles = Styles.styleSheetCreate(() => ({
  containerNew: {
    ...Styles.padding(6, Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.blueGrey,
    justifyContent: 'space-between',
  },
  filterInput: {
    marginRight: Styles.globalMargins.tiny,
    maxWidth: 148,
  },
  headerButton: Styles.platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
  text: {padding: Styles.globalMargins.xtiny},
}))

export default AddEmoji
