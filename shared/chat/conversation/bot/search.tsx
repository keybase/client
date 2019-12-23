/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import * as BotsGen from '../../../actions/bots-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Styles from '../../../styles'
import Bot from '../info-panel/bot'
import debounce from 'lodash/debounce'

type Props = Container.RouteProps<{conversationIDKey?: Types.ConversationIDKey}>

const renderSectionHeader = ({section}) => {
  return <Kb.SectionDivider label={section.title} />
}

const SearchBotPopup = (props: Props) => {
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', undefined)

  // state
  const [lastQuery, setLastQuery] = React.useState('')
  const {featuredBotsMap, results} = Container.useSelector((state: Container.TypedState) => ({
    featuredBotsMap: state.chat2.featuredBotsMap,
    results: state.chat2.botSearchResults,
  }))
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSearch = debounce((query: string) => {
    setLastQuery(query)
    dispatch(BotsGen.createSearchFeaturedAndUsers({query}))
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
  }, [])

  const botSection = {
    data: lastQuery.length > 0 ? results?.bots ?? [] : [...featuredBotsMap.values()],
    renderItem: ({item}: {item: RPCTypes.FeaturedBot}) => {
      return <Bot {...item} onClick={onSelect} />
    },
    title: 'Featured bots',
  }
  const usersSection = {
    data: results?.users ?? [],
    renderItem: ({item}: {item: string}) => {
      return (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          style={{...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny)}}
        >
          <Kb.NameWithIcon username={item} horizontal={true} colorFollowing={true} />
        </Kb.Box2>
      )
    },
    title: 'Users',
  }
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ),
        title: 'Add a bot',
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.modal}>
        <Kb.SearchFilter
          size="full-width"
          focusOnMount={true}
          onChange={onSearch}
          placeholderText="Search bots and users..."
        />
        <Kb.SectionList
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          sections={[botSection, usersSection]}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  modal: Styles.platformStyles({
    isElectron: {
      height: 500,
    },
  }),
}))

export default SearchBotPopup
