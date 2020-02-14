import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import ChannelTabs from './tabs/container'
import {Row} from './rows'
import renderRow from './rows/render'
import SelectionPopup from './selection-popup'
export type Sections = Array<{data: Array<Row>; header?: Row; key: string}>

export type Props = {
  teamID: Types.TeamID
  selectedTab: Types.TabKey
  sections: Sections
  setSelectedTab: (arg0: Types.TabKey) => void
}

const Channel = props => {
  const renderItem = ({item}: {item: Row}) => {
    switch (item.type) {
      case 'tabs':
        return (
          <ChannelTabs
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
      case 'loading':
        return renderRow(item, props.teamID)
      default: {
        throw new Error(`Impossible case encountered in channel page list: ${item}`)
      }
    }
  }

  const renderSectionHeader = ({section}) => (section.header ? renderItem({item: section.header}) : null)

  const popupAnchor = React.useRef<React.Component<any>>(null)

  return (
    <Kb.Box style={styles.container}>
      <Kb.SectionList
        alwaysVounceVertical={false}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Styles.isMobile}
        sections={props.sections}
        style={styles.list}
        contentContainerStyle={styles.listContentContainer}
      />
      <Kb.Box fullWidth={true} style={styles.endAnchor} ref={popupAnchor} />
      <SelectionPopup
        attachTo={() => popupAnchor.current}
        selectedTab={props.selectedTab}
        teamID={props.teamID}
      />
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
  endAnchor: {
    flex: 1,
    height: 0,
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

export default Channel
