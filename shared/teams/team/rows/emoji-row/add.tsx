import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/teams'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Chat2Types from '../../../../constants/types/chat2'

type OwnProps = {
  teamID: Types.TeamID
  convID: Chat2Types.ConversationIDKey
  filter: string
  setFilter: (filter: string) => void
}
const AddEmoji = ({teamID, convID, filter, setFilter}: OwnProps) => {
  const dispatch = Container.useDispatch()
  const onAddEmoji = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: convID, teamID},
            selected: 'teamAddEmoji',
          },
        ],
      })
    )
  const onAddAlias = () => {}
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
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.padding(Styles.globalMargins.tiny, 0),
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    isMobile: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  containerNew: {
    ...Styles.padding(6, Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.blueGrey,
    justifyContent: 'space-between',
  },
  filterInput: {maxWidth: 148},
  text: {padding: Styles.globalMargins.xtiny},
}))

export default AddEmoji
