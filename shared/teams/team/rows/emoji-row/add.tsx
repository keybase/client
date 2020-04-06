import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/teams'
import * as Container from '../../../../util/container'
import * as ChatTypes from '../../../../constants/types/chat2'

type OwnProps = {
  teamID: Types.TeamID
  convID: ChatTypes.ConversationIDKey
  filter: string
  reloadEmojis: () => void
  setFilter: (filter: string) => void
}
const AddEmoji = ({teamID, convID, filter, reloadEmojis, setFilter}: OwnProps) => {
  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  const onAddEmoji = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {conversationIDKey: convID, onChange: reloadEmojis, teamID},
            selected: 'teamAddEmoji',
          },
        ],
      })
    )
  const onAddAlias = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {conversationIDKey: convID, onChange: reloadEmojis},
            selected: 'teamAddEmojiAlias',
          },
        ],
      })
    )
  // clear filter on unmount
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew}>
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.Button mode="Secondary" label="Add emoji" onClick={onAddEmoji} small={true} />
        <Kb.Button mode="Secondary" label="Add alias" onClick={onAddAlias} small={true} />
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
  filterInput: {maxWidth: 148},
  text: {padding: Styles.globalMargins.xtiny},
}))

export default AddEmoji
