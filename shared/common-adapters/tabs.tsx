import * as Styles from '@/styles'
import Badge from './badge'
import Divider from './divider'
import IconAuto from './icon-auto'
import type {IconType} from './icon.constants-gen'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {Box2, ClickableBox} from './box'
import capitalize from 'lodash/capitalize'

const Kb = {
  Badge,
  Box2,
  ClickableBox,
  Divider,
  IconAuto,
  ProgressIndicator,
  Text,
}

export type Tab<TitleT extends string> = {
  title: TitleT
  text?: string // text to show instead of title
  icon?: IconType
  badgeNumber?: number
  testID?: string // e2e: needed for icon-only tabs that have no tappable text
}

type Props<TitleT extends string> = {
  clickableBoxStyle?: Styles.StylesCrossPlatform
  tabs: Array<Tab<TitleT>>
  onSelect: (title: TitleT) => void
  clickableTabStyle?: Styles.StylesCrossPlatform
  selectedTab?: TitleT
  style?: Styles.StylesCrossPlatform
  tabStyle?: Styles.StylesCrossPlatform
  showProgressIndicator?: boolean
}

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Box2 direction="horizontal" justifyContent="center">
    <Kb.Text type="BodySmallSemibold" style={selected ? styles.selected : undefined}>
      {text}
    </Kb.Text>
  </Kb.Box2>
)

const Tabs = <TitleT extends string>(props: Props<TitleT>) => {
  const {onSelect} = props
  return (
    <Kb.Box2
      direction="horizontal"
      flex={1}
      style={Styles.collapseStyles([styles.container, props.style])}
      alignItems="flex-start"
      fullWidth={true}
    >
      {props.tabs.map((tab: Tab<TitleT>) => {
        const selected = props.selectedTab === tab.title
        return (
          <Kb.ClickableBox
            onClick={() => onSelect(tab.title)}
            key={tab.title}
            testID={tab.testID}
            direction="vertical"
            style={Styles.collapseStyles([
              styles.tabContainer,
              props.clickableBoxStyle,
              props.clickableTabStyle,
            ])}
          >
            <Kb.Box2
              direction="horizontal"
              fullWidth={true}
              alignItems="center"
              justifyContent="center"
              style={Styles.collapseStyles([styles.tab, selected && styles.selected, props.tabStyle])}
            >
              {tab.icon ? (
                <Kb.IconAuto type={tab.icon} style={selected ? styles.iconSelected : styles.icon} />
              ) : (
                <TabText selected={selected} text={tab.text ?? capitalize(tab.title)} />
              )}
              {!!tab.badgeNumber && <Kb.Badge badgeNumber={tab.badgeNumber} badgeStyle={styles.badge} />}
            </Kb.Box2>
            <Kb.Divider style={selected ? styles.dividerSelected : styles.divider} />
          </Kb.ClickableBox>
        )
      })}
      {props.showProgressIndicator && <Kb.ProgressIndicator style={styles.progressIndicator} />}
    </Kb.Box2>
  )
}

const dividerBase = {
  ...Styles.globalStyles.flexBoxRow,
  minHeight: 2,
  width: '100%',
} as const

const styles = Styles.styleSheetCreate(() => ({
  badge: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.xtiny,
    },
    isMobile: {
      marginLeft: 2,
      marginTop: 1,
    },
  }),
  container: {
    ...Styles.bottomDivider(),
    maxHeight: isMobile ? 48 : 40,
  },
  divider: {
    ...dividerBase,
    backgroundColor: Styles.globalColors.transparent,
  },
  dividerSelected: {
    ...dividerBase,
    backgroundColor: Styles.globalColors.blue,
  },
  icon: {
    alignSelf: 'center',
  },
  iconSelected: {
    alignSelf: 'center',
    color: Styles.globalColors.black,
  },
  progressIndicator: {
    ...Styles.size(17),
  },
  selected: {
    color: Styles.globalColors.black,
  },
  tab: {
    flex: 1,
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, Styles.globalMargins.xtiny),
  },
  tabContainer: Styles.platformStyles({
    // flexGrow (not fullWidth) so tabs share the row: in a bounded row they
    // distribute evenly, and inside a horizontal ScrollView (team/channel tabs)
    // they fill the min-100%-width content instead of each claiming 100% (which
    // pushed all but the first tab off-screen).
    common: {
      flexGrow: 1,
    },
    isElectron: {
      height: 40,
    },
    isMobile: {
      height: 48,
    },
  }),
}))

export default Tabs
