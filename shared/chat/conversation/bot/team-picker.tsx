import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/chat2'
import * as BotsGen from '../../../actions/bots-gen'
import debounce from 'lodash/debounce'

type Props = Container.RouteProps<{botUsername: string}>

const BotTeamPicker = (props: Props) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const [term, setTerm] = React.useState('')
  const [results, setResults] = React.useState<Array<RPCChatTypes.AddBotConvSearchHit>>([])
  const submit = Container.useRPC(RPCChatTypes.localAddBotConvSearchRpcPromise)
  const dispatch = Container.useDispatch()
  const doSearch = () => {
    submit(
      [{term}],
      result => setResults(result ?? []),
      error => console.log('ERROR: ' + error.message)
    )
  }
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSelect = (convID: RPCChatTypes.ConversationID) => {
    const conversationIDKey = Types.conversationIDToKey(convID)
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              botUsername,
              conversationIDKey,
              namespace: 'chat2',
            },
            selected: 'chatInstallBot',
          },
        ],
      })
    )
  }
  React.useEffect(() => {
    doSearch()
  }, [term])
  React.useEffect(() => {
    dispatch(BotsGen.createGetFeaturedBots({}))
  }, [])

  const renderResult = (index: number, item: RPCChatTypes.AddBotConvSearchHit) => {
    return (
      <Kb.ClickableBox key={index} onClick={() => onSelect(item.convID)}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.results}>
          <Kb.Avatar username={item.name} size={32} isTeam={item.isTeam} teamname={item.name} />
          <Kb.Text type="Body" style={{alignSelf: 'center'}}>
            {item.name}
          </Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ) : (
          undefined
        ),
        title: 'Add to team or chat',
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.SearchFilter
            size="full-width"
            icon="iconfont-search"
            placeholderText={`Search chats and teams...`}
            placeholderCentered={true}
            mobileCancelButton={true}
            onChange={debounce(setTerm, 200)}
            style={styles.searchFilter}
            focusOnMount={true}
          />
        </Kb.Box2>
        <Kb.List2
          indexAsKey={true}
          items={results}
          itemHeight={{sizeType: 'Small', type: 'fixedListItem2Auto'}}
          renderItem={renderResult}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          height: 560,
        },
      }),
      results: {
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
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
