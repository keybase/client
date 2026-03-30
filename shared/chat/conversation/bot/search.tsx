import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import debounce from 'lodash/debounce'
import * as T from '@/constants/types'
import * as S from '@/constants/strings'
import logger from '@/logger'
import {Bot} from '../info-panel/bot'
import {getFeaturedSorted, useFeaturedBotPage} from '@/util/featured-bots'

type Props = {teamID?: T.Teams.TeamID}
type BotSearchResults = {
  bots: ReadonlyArray<T.RPCGen.FeaturedBot>
  users: ReadonlyArray<string>
}

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
  const [botSearchResults, setBotSearchResults] = React.useState(
    new Map<string, BotSearchResults | undefined>()
  )
  const {featuredBots} = useFeaturedBotPage()
  const featuredBotsMap = new Map(featuredBots.map(bot => [bot.botUsername, bot] as const))
  const searchFeaturedBots = C.useRPC(T.RPCGen.featuredBotSearchRpcPromise)
  const searchUsers = C.useRPC(T.RPCGen.userSearchUserSearchRpcPromise)
  const waiting = C.Waiting.useAnyWaiting([C.waitingKeyBotsSearchUsers, C.waitingKeyBotsSearchFeatured])
  const navigateAppend = C.Router2.navigateAppend

  const setResultsForQuery = React.useCallback((query: string, results?: BotSearchResults) => {
    setBotSearchResults(prev => {
      const next = new Map(prev)
      next.set(query, results)
      return next
    })
  }, [])
  const onSearch = React.useMemo(
    () =>
      debounce((query: string) => {
        setLastQuery(query)
        if (query.length === 0) {
          setResultsForQuery(query, undefined)
          return
        }

        let nextBots: ReadonlyArray<T.RPCGen.FeaturedBot> = []
        let nextUsers: ReadonlyArray<string> = []
        let pending = 2
        let failed = false
        const finish = () => {
          pending -= 1
          if (pending === 0 && !failed) {
            setResultsForQuery(query, {bots: nextBots, users: nextUsers})
          }
        }

        searchFeaturedBots(
          [{limit: 10, offset: 0, query}, S.waitingKeyBotsSearchFeatured],
          result => {
            nextBots = result.bots ?? []
            finish()
          },
          error => {
            failed = true
            logger.info(`searchFeaturedAndUsers: failed to run bot search: ${error.message}`)
          }
        )
        searchUsers(
          [
            {
              includeContacts: false,
              includeServicesSummary: false,
              maxResults: 10,
              query,
              service: 'keybase',
            },
            S.waitingKeyBotsSearchUsers,
          ],
          result => {
            nextUsers =
              result?.reduce<Array<string>>((usernames, user) => {
                const username = user.keybase?.username
                if (username) {
                  usernames.push(username)
                }
                return usernames
              }, []) ?? []
            finish()
          },
          error => {
            failed = true
            logger.info(`searchFeaturedAndUsers: failed to run user search: ${error.message}`)
          }
        )
      }, 200),
    [searchFeaturedBots, searchUsers, setResultsForQuery]
  )
  const onSelect = (username: string) => {
    navigateAppend({
      name: 'chatInstallBot',
      params: {botUsername: username, conversationIDKey, teamID},
    })
  }

  C.useOnMountOnce(() => {
    setResultsForQuery('', undefined)
  })
  React.useEffect(() => () => onSearch.cancel(), [onSearch])

  const botData: Array<Item> =
    lastQuery.length > 0
      ? (botSearchResults
          .get(lastQuery)
          ?.bots.slice()
          .map(bot => ({bot, type: 'bot'}) as const) ?? [])
      : getFeaturedSorted(featuredBots).map(bot => ({bot, type: 'bot'}))
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
    <>
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.modal}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
          <Kb.SearchFilter
            size="full-width"
            focusOnMount={true}
            onChange={query => onSearch(query)}
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
    </>
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
