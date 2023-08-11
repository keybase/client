import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as C from '../../../constants'
import * as BotsConstants from '../../../constants/bots'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Types from '../../../constants/types/chat2'
import {Avatars, TeamAvatar} from '../../avatars'
import debounce from 'lodash/debounce'
import logger from '../../../logger'

type Props = {
  botUsername: string
}

const BotTeamPicker = (props: Props) => {
  const botUsername = props.botUsername
  const [term, setTerm] = React.useState('')
  const [results, setResults] = React.useState<Array<RPCChatTypes.ConvSearchHit>>([])
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const submit = Container.useRPC(RPCChatTypes.localAddBotConvSearchRpcPromise)

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
  const onSelect = (convID: RPCChatTypes.ConversationID) => {
    const conversationIDKey = Types.conversationIDToKey(convID)
    navigateAppend({
      props: {botUsername, conversationIDKey},
      selected: 'chatInstallBot',
    })
  }

  const getFeaturedBots = BotsConstants.useState(s => s.dispatch.getFeaturedBots)
  Container.useOnMountOnce(() => {
    getFeaturedBots()
  })

  const renderResult = (index: number, item: RPCChatTypes.ConvSearchHit) => {
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
        leftButton: Styles.isMobile ? (
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
            <Kb.Text type="Body" style={{alignSelf: 'center', color: Styles.globalColors.redDark}}>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          height: 450,
        },
      }),
      results: Styles.platformStyles({
        common: {
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
        },
      }),
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
    }) as const
)

export default BotTeamPicker
