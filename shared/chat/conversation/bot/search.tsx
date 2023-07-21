import * as BotsGen from '../../../actions/bots-gen'
import * as Constants from '../../../constants/bots'
import * as RouterConstants from '../../../constants/router2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import debounce from 'lodash/debounce'
import shallowEqual from 'shallowequal'
import type * as RPCTypes from '../../../constants/types/rpc-gen'
import type * as TeamsTypes from '../../../constants/types/teams'
import type * as Types from '../../../constants/types/chat2'
import {Bot} from '../info-panel/bot'

type Props = {
  conversationIDKey?: Types.ConversationIDKey
  teamID?: TeamsTypes.TeamID
}

const renderSectionHeader = ({section}: any) => {
  return <Kb.SectionDivider label={section.title} />
}

const userEmptyPlaceholder = '---EMPTYUSERS---'
const resultEmptyPlaceholder = '---EMPTYRESULT---'

const getResults = (state: Container.TypedState) => {
  const {botSearchResults, featuredBotsMap} = state.chat2
  return {botSearchResults, featuredBotsMap}
}
const SearchBotPopup = (props: Props) => {
  const conversationIDKey = props.conversationIDKey
  const teamID = props.teamID
  const [lastQuery, setLastQuery] = React.useState('')
  const {featuredBotsMap, botSearchResults} = Container.useSelector(getResults, shallowEqual)
  const waiting = Container.useAnyWaiting([
    Constants.waitingKeyBotSearchUsers,
    Constants.waitingKeyBotSearchFeatured,
  ])
  const dispatch = Container.useDispatch()
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
  }
  const onSearch = debounce((query: string) => {
    setLastQuery(query)
    if (query.length > 0) {
      dispatch(BotsGen.createSearchFeaturedAndUsers({query}))
    } else {
      dispatch(BotsGen.createSetSearchFeaturedAndUsersResults({query, results: undefined}))
    }
  }, 200)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onSelect = (username: string) => {
    navigateAppend({
      props: {botUsername: username, conversationIDKey, teamID},
      selected: 'chatInstallBot',
    })
  }

  Container.useOnMountOnce(() => {
    dispatch(BotsGen.createSetSearchFeaturedAndUsersResults({query: '', results: undefined}))
    dispatch(BotsGen.createGetFeaturedBots({}))
  })

  const botData: Array<RPCTypes.FeaturedBot | string> =
    lastQuery.length > 0
      ? botSearchResults?.get(lastQuery)?.bots.slice() ?? []
      : Constants.getFeaturedSorted(featuredBotsMap)
  if (!botData.length && !waiting) {
    botData.push(resultEmptyPlaceholder)
  }
  const botSection = {
    data: botData,
    renderItem: ({index, item}: {index: number; item: RPCTypes.FeaturedBot | string}) => {
      return item === resultEmptyPlaceholder ? (
        <Kb.Text
          style={{...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny)}}
          type="BodySmall"
        >
          No results were found
        </Kb.Text>
      ) : typeof item !== 'string' ? (
        <Bot {...item} onClick={onSelect} firstItem={index === 0} />
      ) : null
    },
    title: 'Featured bots',
  }
  const userData = !lastQuery.length
    ? [userEmptyPlaceholder]
    : botSearchResults
        .get(lastQuery)
        ?.users.filter(u => !featuredBotsMap.get(u))
        .slice(0, 3) ?? []
  if (!userData.length && !waiting) {
    userData.push(resultEmptyPlaceholder)
  }
  const usersSection = {
    data: userData,
    renderItem: ({item}: {item: string}) => {
      return (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          style={{...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny)}}
        >
          {item === userEmptyPlaceholder ? (
            <Kb.Text type="BodySmall">Enter a bot username above</Kb.Text>
          ) : item === resultEmptyPlaceholder ? (
            <Kb.Text type="BodySmall">No results were found</Kb.Text>
          ) : (
            <Kb.NameWithIcon
              username={item}
              horizontal={true}
              colorFollowing={true}
              onClick={onSelect}
              clickType="onClick"
            />
          )}
        </Kb.Box2>
      )
    },
    title: 'Users',
  }
  return (
    <Kb.Modal
      onClose={onClose}
      noScrollView={true}
      header={{
        leftButton: Styles.isMobile ? (
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

const styles = Styles.styleSheetCreate(() => ({
  inputContainer: Styles.platformStyles({
    isElectron: {padding: Styles.globalMargins.tiny},
  }),
  modal: Styles.platformStyles({
    isElectron: {height: 500},
  }),
}))

export default SearchBotPopup
