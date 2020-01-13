import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import debounce from 'lodash/debounce'

const BotTeamPicker = () => {
  const [results, setResults] = React.useState<Array<RPCChatTypes.AddBotConvSearchHit>>([])
  const doSearch = debounce((term: string) => {
    submit(
      [
        {
          term,
        },
      ],
      result => setResults(result ?? []),
      error => console.log('ERROR: ' + error.message)
    )
  })
  const submit = Container.useRPC(RPCChatTypes.localAddBotConvSearchRpcPromise)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.SearchFilter
          size="full-width"
          icon="iconfont-search"
          placeholderText={`Search chats and teams...`}
          placeholderCentered={true}
          mobileCancelButton={true}
          hotkey="f"
          onChange={doSearch}
          style={styles.searchFilter}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      searchFilter: Styles.platformStyles({
        common: {
          marginBottom: Styles.globalMargins.xsmall,
          marginTop: Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
        },
      }),
    } as const)
)

export default BotTeamPicker
