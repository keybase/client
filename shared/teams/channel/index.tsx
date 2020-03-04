import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import ChannelTabs from './tabs/container'
import {TabKey} from './tabs'
import {Row} from './rows'
import renderRow from './rows/render'
export type Sections = Array<{data: Array<Row>; header?: Row; key: string}>

export type TabProps = {
  selectedTab: TabKey
  setSelectedTab: (t: TabKey) => void
}

export type Props = {
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
  sections: Sections
}

const Channel = (props: Props & TabProps) => {
  const {teamID, conversationIDKey, selectedTab, setSelectedTab} = props
  const renderItem = ({item}: {item: Row}) => {
    switch (item.type) {
      case 'tabs':
        return (
          <ChannelTabs
            teamID={teamID}
            conversationIDKey={conversationIDKey}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
          />
        )
      case 'settings':
      case 'header':
      case 'divider':
      case 'member':
      case 'bot':
      case 'bot-add':
      case 'loading':
        return renderRow(item, teamID, conversationIDKey)
      default: {
        throw new Error(`Impossible case encountered in channel page list: ${item}`)
      }
    }
  }

  const renderSectionHeader = ({section}) => (section.header ? renderItem({item: section.header}) : null)

  return (
    <Kb.Box style={styles.container}>
      {Styles.isMobile && <MobileHeader />}
      <Kb.SectionList
        alwaysVounceVertical={false}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Styles.isMobile}
        sections={props.sections}
        style={styles.list}
        contentContainerStyle={styles.listContentContainer}
      />
    </Kb.Box>
  )
}

const MobileHeader = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" style={styles.header}>
      <Kb.BackButton onClick={onBack} style={styles.backButton} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  backButton: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  endAnchor: {
    flex: 1,
    height: 0,
  },
  header: {height: 40, left: 0, position: 'absolute', right: 0, top: 0},
  list: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
    isMobile: {
      ...Styles.globalStyles.fillAbsolute,
      position: 'relative',
      top: 40,
    },
  }),
  listContentContainer: Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
}))

export default Channel
