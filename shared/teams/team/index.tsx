import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import Settings from './settings-tab/container'
import TeamHeader from './header/container'
import TeamTabs from './tabs/container'
import {Row} from './rows'
import renderRow from './rows/render'

export type Sections = Array<{data: Array<Row>; header?: Row; key: string}>

export type Props = {
  load: () => void
  teamID: Types.TeamID
  teamname: Types.Teamname
  selectedTab: string
  sections: Sections
  setSelectedTab: (arg0: Types.TabKey) => void
}

class Team extends React.Component<Props> {
  componentDidUpdate(prevProps: Props) {
    if (this.props.teamID !== prevProps.teamID) {
      this.props.load()
    }
  }
  private renderItem = ({item}: {item: Row}) => {
    switch (item.type) {
      case 'header':
        return <TeamHeader key="header" teamname={this.props.teamname} />
      case 'tabs': {
        return (
          <TeamTabs
            key="tabs"
            teamname={this.props.teamname}
            selectedTab={this.props.selectedTab}
            setSelectedTab={this.props.setSelectedTab}
          />
        )
      }
      case 'member':
      case 'invites-invite':
      case 'invites-request':
      case 'invites-divider':
      case 'invites-none':
      case 'subteam-intro':
      case 'subteam-add':
      case 'subteam-none':
      case 'subteam-subteam':
        return renderRow(item, this.props.teamID)
      case 'settings':
        // @ts-ignore doesn't seem to understand connect here
        return <Settings key="settings" teamname={this.props.teamname} />
      default: {
        throw new Error(`Impossible case encountered in team page list: ${item}`)
      }
    }
  }

  private renderSectionHeader = ({section}) =>
    section.header ? this.renderItem({item: section.header}) : null

  render() {
    return (
      <Kb.Reloadable
        waitingKeys={Constants.teamGetWaitingKey(this.props.teamname)}
        onReload={this.props.load}
        reloadOnMount={true}
      >
        <Kb.Box style={styles.container}>
          <Kb.SectionList
            alwaysVounceVertical={false}
            renderItem={this.renderItem}
            renderSectionHeader={this.renderSectionHeader}
            stickySectionHeadersEnabled={Styles.isMobile}
            sections={this.props.sections}
            style={styles.list}
            contentContainerStyle={styles.listContentContainer}
          />
        </Kb.Box>
      </Kb.Reloadable>
    )
  }
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
