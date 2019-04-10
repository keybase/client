// @flow
import * as Kb from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'
import type {Props} from '.'

const icons = {
  [Tabs.chatTab]: 'iconfont-nav-2-chat',
  [Tabs.teamsTab]: 'iconfont-nav-2-teams',
  [Tabs.peopleTab]: 'iconfont-nav-2-people',
  [Tabs.settingsTab]: 'iconfont-nav-2-more',
  [Tabs.walletsTab]: 'iconfont-nav-2-wallets',
}

const tabs = [Tabs.peopleTab, Tabs.chatTab, Tabs.teamsTab, Tabs.settingsTab]

// Immediately draw selected and don't wait for the store
type State = {|justSelected: ?string|}
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
        <Kb.NativeSafeAreaView style={styles.safe}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
            {tabs.map(t => (
              <Kb.Box2 key={t} direction="vertical" style={styles.iconContainer}>
                <Kb.Icon
                  type={icons[t]}
                  onClick={() => this._onTabClick(t)}
                  fontSize={32}
                  style={styles.tab}
                  color={t === selectedTab ? Styles.globalColors.white : Styles.globalColors.darkBlue4}
                />
                {!!p.badgeNumbers[t] && (
                  <Kb.Badge badgeNumber={p.badgeNumbers[t]} badgeStyle={styles.badge} />
                )}
              </Kb.Box2>
            ))}
          </Kb.Box2>
        </Kb.NativeSafeAreaView>
      )
    )
  }
}

// TEMP to really know you're on this branch. Leave until we flip the feature flag
const backgroundColor = 'pink' // Styles.globalColors.darkBlue2,

const styles = Styles.styleSheetCreate({
  badge: {
    position: 'absolute',
    right: 8,
    top: 3,
  },
  container: {
    alignItems: 'center',
    backgroundColor,
    height: Styles.isAndroid ? 56 : 48,
    justifyContent: 'space-around',
  },
  iconContainer: {
    position: 'relative',
  },
  // When we have new tabs
  meta: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  safe: {
    backgroundColor,
    flexGrow: 0,
  },
  tab: {
    paddingBottom: 6,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 6,
  },
})

export default TabBar
