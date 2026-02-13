import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {Avatars, TeamAvatar} from '@/chat/avatars'
import debounce from 'lodash/debounce'
import logger from '@/logger'
import {useBotsState} from '@/stores/bots'

type Props = {botUsername: string}

const BotTeamPicker = (props: Props) => {
  const botUsername = props.botUsername
  const [term, setTerm] = React.useState('')
  const [results, setResults] = React.useState<ReadonlyArray<T.RPCChat.ConvSearchHit>>([])
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const submit = C.useRPC(T.RPCChat.localAddBotConvSearchRpcPromise)

  const [lastTerm, setLastTerm] = React.useState('init')
  if (lastTerm !== term) {
    setLastTerm(term)
    setWaiting(true)
    submit(
      [{term}],
      result => {
        setWaiting(false)
        setResults(result ?? [])
      },
      error => {
        setWaiting(false)
        setError('Something went wrong, please try again.')
        logger.info('BotTeamPicker: error loading search results: ' + error.message)
      }
    )
  }

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onSelect = (convID: T.RPCChat.ConversationID) => {
    const conversationIDKey = T.Chat.conversationIDToKey(convID)
    navigateAppend({
      props: {botUsername, conversationIDKey},
      selected: 'chatInstallBot',
    })
  }

  const getFeaturedBots = useBotsState(s => s.dispatch.getFeaturedBots)
  C.useOnMountOnce(() => {
    getFeaturedBots()
  })

  const renderResult = (index: number, item: T.RPCChat.ConvSearchHit) => {
    return (
      <Kb.ClickableBox key={index} onClick={() => onSelect(item.convID)}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.results}>
          {item.isTeam ? (
            <TeamAvatar isHovered={false} isMuted={false} isSelected={false} teamname={item.name} />
          ) : (
            <Avatars participantOne={item.parts?.[0]} participantTwo={item.parts?.[1]} />
          )}
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
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ) : undefined,
        title: 'Add to team or chat',
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.SearchFilter
            size="full-width"
            icon="iconfont-search"
            placeholderText={`Search chats and teams...`}
            placeholderCentered={true}
            onChange={debounce(setTerm, 200)}
            style={styles.searchFilter}
            focusOnMount={true}
            waiting={waiting}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          {error.length > 0 ? (
            <Kb.Text type="Body" style={{alignSelf: 'center', color: Kb.Styles.globalColors.redDark}}>
              {error}
            </Kb.Text>
          ) : (
            <Kb.List2
              indexAsKey={true}
              items={results}
              itemHeight={{sizeType: 'Large', type: 'fixedListItem2Auto'}}
              renderItem={renderResult}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          height: 450,
        },
      }),
      results: Kb.Styles.platformStyles({
        common: {
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
        },
      }),
      searchFilter: Kb.Styles.platformStyles({
        common: {
          marginBottom: Kb.Styles.globalMargins.xsmall,
          marginTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
      }),
    }) as const
)

export default BotTeamPicker
