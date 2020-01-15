/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/bots'
import * as BotsGen from '../../../actions/bots-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Styles from '../../../styles'
import * as TeamTypes from '../../../constants/types/teams'
import Bot from '../info-panel/bot'
import debounce from 'lodash/debounce'

type Props = Container.RouteProps<{conversationIDKey?: Types.ConversationIDKey; teamID?: TeamTypes.TeamID}>

const renderSectionHeader = ({section}: any) => {
  return <Kb.SectionDivider label={section.title} />
}

const userEmptyPlaceholder = '---EMPTYUSERS---'

const SearchBotPopup = (props: Props) => {
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', undefined)
  const teamID = Container.getRouteProps(props, 'teamID', undefined)

  // state
  const [lastQuery, setLastQuery] = React.useState('')
  const {featuredBotsMap, results} = Container.useSelector((state: Container.TypedState) => ({
    featuredBotsMap: state.chat2.featuredBotsMap,
    results: state.chat2.botSearchResults,
  }))
  const waiting = Container.useAnyWaiting(
    Constants.waitingKeyBotSearchUsers,
    Constants.waitingKeyBotSearchFeatured
  )
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSearch = debounce((query: string) => {
    setLastQuery(query)
    if (query.length > 0) {
      dispatch(BotsGen.createSearchFeaturedAndUsers({query}))
    } else {
      dispatch(BotsGen.createSetSearchFeaturedAndUsersResults({results: undefined}))
    }
  }, 200)
  const onSelect = (username: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              botUsername: username,
              conversationIDKey,
              namespace: 'chat2',
              teamID,
            },
            selected: 'chatInstallBot',
          },
        ],
      })
    )
  }
  // lifecycle
  React.useEffect(() => {
    dispatch(BotsGen.createSetSearchFeaturedAndUsersResults({results: undefined}))
    dispatch(BotsGen.createGetFeaturedBots({}))
  }, [])

  const botSection = {
    data: lastQuery.length > 0 ? results?.bots ?? [] : Constants.getFeaturedSorted(featuredBotsMap),
    renderItem: ({item}: {item: RPCTypes.FeaturedBot}) => {
      return <Bot {...item} onClick={onSelect} />
    },
    title: 'Featured bots',
  }
  const usersSection = {
    data: !lastQuery.length
      ? [userEmptyPlaceholder]
      : results?.users.filter(u => !featuredBotsMap.get(u)).slice(0, 3) ?? [],
    renderItem: ({item}: {item: string}) => {
      return (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          style={{...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny)}}
        >
          {item === userEmptyPlaceholder ? (
            <Kb.Text type="BodySmall">Enter a bot username above</Kb.Text>
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
      header={{
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ) : (
          undefined
        ),
        title: 'Add a bot',
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.modal}>
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
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  inputContainer: Styles.platformStyles({
    isElectron: {
      padding: Styles.globalMargins.tiny,
    },
  }),
  modal: Styles.platformStyles({
    isElectron: {
      height: 500,
    },
  }),
}))

export default SearchBotPopup
