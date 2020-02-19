import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import TeamTabs from './tabs/container'
import {Row} from './rows'
import renderRow from './rows/render'
import {TeamDetailsSubscriber, TeamsSubscriber} from '../subscriber'
import SelectionPopup from './selection-popup'
export type Sections = Array<{data: Array<Row>; header?: Row; key: string}>

export type Props = {
  teamID: Types.TeamID
  selectedTab: Types.TabKey
  sections: Sections
  setSelectedTab: (arg0: Types.TabKey) => void
}

const Team = props => {
  const renderItem = ({item}: {item: Row}) => {
    switch (item.type) {
      case 'tabs':
        return (
          <TeamTabs
            teamID={props.teamID}
            selectedTab={props.selectedTab}
            setSelectedTab={props.setSelectedTab}
          />
        )
      case 'settings':
      case 'header':
      case 'divider':
      case 'member':
      case 'bot':
      case 'bot-add':
      case 'channel':
      case 'channel-header':
      case 'channel-footer':
      case 'invites-invite':
      case 'invites-request':
      case 'invites-divider':
      case 'invites-none':
      case 'subteam-intro':
      case 'subteam-add':
      case 'subteam-none':
      case 'subteam-subteam':
      case 'subteam-info':
      case 'loading':
        return renderRow(item, props.teamID)
      default: {
        throw new Error(`Impossible case encountered in team page list: ${item}`)
      }
    }
  }

  const renderSectionHeader = ({section}) => (section.header ? renderItem({item: section.header}) : null)

  return (
    <Kb.Box style={styles.container}>
      <TeamsSubscriber />
      <TeamDetailsSubscriber teamID={props.teamID} />
      <Kb.SectionList
        alwaysVounceVertical={false}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Styles.isMobile}
        sections={props.sections}
        style={styles.list}
        contentContainerStyle={styles.listContentContainer}
      />
      <SelectionPopup selectedTab={props.selectedTab} teamID={props.teamID} />
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  list: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
    isMobile: {
      ...Styles.globalStyles.fillAbsolute,
    },
  }),
  listContentContainer: Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
}))

export default Team
