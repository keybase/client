import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import debounce from 'lodash/debounce'
import type * as T from '@/constants/types'
import {Bot} from '../info-panel/bot'
import {getFeaturedSorted, useBotsState} from '@/stores/bots'

type Props = {teamID?: T.Teams.TeamID}

const renderSectionHeader = ({section}: {section: {title?: string}}) => {
  return <Kb.SectionDivider label={section.title} />
}

const userEmptyPlaceholder = '---EMPTYUSERS---' as const
const resultEmptyPlaceholder = '---EMPTYRESULT---' as const

type Item =
  | {type: 'bot'; bot: T.RPCGen.FeaturedBot}
  | {type: 'str'; str: string}
  | {type: 'dummy'; value: typeof userEmptyPlaceholder | typeof resultEmptyPlaceholder}
type Section = Omit<Kb.SectionType<Item>, 'title'> & {title: string}

const SearchBotPopup = (props: Props) => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const teamID = props.teamID
  const [lastQuery, setLastQuery] = React.useState('')
  const botsState = useBotsState(
    C.useShallow(s => ({
      botSearchResults: s.botSearchResults,
      featuredBotsMap: s.featuredBotsMap,
      getFeaturedBots: s.dispatch.getFeaturedBots,
      searchFeaturedAndUsers: s.dispatch.searchFeaturedAndUsers,
      setSearchFeaturedAndUsersResults: s.dispatch.setSearchFeaturedAndUsersResults,
    }))
  )
  const {botSearchResults, featuredBotsMap, getFeaturedBots} = botsState
  const {searchFeaturedAndUsers, setSearchFeaturedAndUsersResults} = botsState
  const waiting = C.Waiting.useAnyWaiting([C.waitingKeyBotsSearchUsers, C.waitingKeyBotsSearchFeatured])
  const {clearModals, navigateAppend} = C.useRouterState(
    C.useShallow(s => ({
      clearModals: s.dispatch.clearModals,
      navigateAppend: s.dispatch.navigateAppend,
    }))
  )
  const onClose = () => {
    clearModals()
  }

  const onSearch = debounce((query: string) => {
    setLastQuery(query)
    if (query.length > 0) {
      searchFeaturedAndUsers(query)
    } else {
      setSearchFeaturedAndUsersResults(query, undefined)
    }
  }, 200)
  const onSelect = (username: string) => {
    navigateAppend({
      props: {botUsername: username, conversationIDKey, teamID},
      selected: 'chatInstallBot',
    })
  }

  C.useOnMountOnce(() => {
    setSearchFeaturedAndUsersResults('', undefined)
    getFeaturedBots()
  })

  const botData: Array<Item> =
    lastQuery.length > 0
      ? (botSearchResults
          .get(lastQuery)
          ?.bots.slice()
          .map(bot => ({bot, type: 'bot'}) as const) ?? [])
      : getFeaturedSorted(featuredBotsMap).map(bot => ({bot, type: 'bot'}))
  if (!botData.length && !waiting) {
    botData.push({type: 'dummy', value: resultEmptyPlaceholder})
  }
  const botSection = {
    data: botData,
    renderItem: ({index, item}: {index: number; item: Item}) => {
      return item.type === 'dummy' && item.value === resultEmptyPlaceholder ? (
        <Kb.Text
          style={{...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny)}}
          type="BodySmall"
        >
          No results were found
        </Kb.Text>
      ) : item.type === 'bot' ? (
        <Bot {...item.bot} onClick={onSelect} firstItem={index === 0} />
      ) : null
    },
    title: 'Featured bots',
  } satisfies Section
  const userData: Array<Item> = !lastQuery.length
    ? [{type: 'dummy', value: userEmptyPlaceholder} as const]
    : (
        botSearchResults
          .get(lastQuery)
          ?.users.filter(u => !featuredBotsMap.get(u))
          .slice(0, 3) ?? []
      ).map(str => ({str, type: 'str'}) as const)

  if (!userData.length && !waiting) {
    userData.push({type: 'dummy', value: resultEmptyPlaceholder} as const)
  }
  const usersSection = {
    data: userData,
    renderItem: ({item}: {item: Item}) => {
      return (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          style={{...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny)}}
        >
          {item.type === 'dummy' && item.value === userEmptyPlaceholder ? (
            <Kb.Text type="BodySmall">Enter a bot username above</Kb.Text>
          ) : item.type === 'dummy' && item.value === resultEmptyPlaceholder ? (
            <Kb.Text type="BodySmall">No results were found</Kb.Text>
          ) : item.type === 'str' ? (
            <Kb.NameWithIcon
              username={item.str}
              horizontal={true}
              colorFollowing={true}
              onClick={onSelect}
              clickType="onClick"
            />
          ) : null}
        </Kb.Box2>
      )
    },
    title: 'Users',
  } satisfies Section
  return (
    <Kb.Modal
      onClose={onClose}
      noScrollView={true}
      header={{
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ) : undefined,
        title: 'Add a bot',
      }}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.modal}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
          <Kb.SearchFilter
            size="full-width"
            focusOnMount={true}
            onChange={onSearch}
            placeholderText="Search featured bots or users..."
            waiting={waiting}
          />
        </Kb.Box2>
        <Kb.SectionList
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          sections={[usersSection, botSection]}
          style={{flexGrow: 1}}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  inputContainer: Kb.Styles.platformStyles({
    isElectron: {padding: Kb.Styles.globalMargins.tiny},
  }),
  modal: Kb.Styles.platformStyles({
    isElectron: {height: 500},
  }),
}))

export default SearchBotPopup
