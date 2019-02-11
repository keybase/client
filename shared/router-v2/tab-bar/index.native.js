// @flow
// TODO badging
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'

const icons = {
  [Tabs.chatTab]: 'iconfont-nav-chat',
  [Tabs.teamsTab]: 'iconfont-nav-teams',
  [Tabs.peopleTab]: 'iconfont-nav-people',
  [Tabs.settingsTab]: 'iconfont-nav-more',
  [Tabs.walletsTab]: 'iconfont-nav-wallets',
}

const tabs = [Tabs.peopleTab, Tabs.chatTab, Tabs.teamsTab, Tabs.settingsTab]

type Props = any
// Immediately draw selected and don't wait for the store
type State = {justSelected: ?string}
class TabBar extends React.PureComponent<Props, State> {
  state = {justSelected: null}
  _onTabClick = justSelected => {
    this.setState(p => (p.justSelected === justSelected ? null : {justSelected}))
    this.props.onTabClick(justSelected)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.selectedTab !== prevProps.selectedTab) {
      const justSelected = this.props.selectedTab
      this.setState(p => (p.justSelected === justSelected ? null : {justSelected}))
    }
  }

  render() {
    const selectedTab = this.state.justSelected || this.props.selectedTab
    const p = this.props
    return (
      !!p.username && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
          {tabs.map(t => (
            <Kb.Icon
              key={t}
              type={icons[t]}
              onClick={() => this._onTabClick(t)}
              fontSize={32}
              style={t === selectedTab ? styles.tabSelected : styles.tab}
              color={t === selectedTab ? Styles.globalColors.white : Styles.globalColors.darkBlue4}
            />
          ))}
        </Kb.Box2>
      )
    )
  }
}

const tab = {}
const styles = Styles.styleSheetCreate({
  container: {
    alignItems: 'center',
    // TEMP to really know you're on this branch
    backgroundColor: 'pink',
    // backgroundColor: Styles.globalColors.darkBlue2,
    height: Styles.isAndroid ? 56 : 48,
    justifyContent: 'space-around',
  },
  tab: {
    ...tab,
  },
  tabSelected: {
    ...tab,
  },
})

export default TabBar
