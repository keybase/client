import * as React from 'react'
import * as Styles from '../styles'
import Badge from './badge'
import ClickableBox from './clickable-box'
import Divider from './divider'
import Icon, {IconType} from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {Box, Box2} from './box'
import ScrollView from './scroll-view'
import capitalize from 'lodash/capitalize'

const Kb = {
  Badge,
  Box,
  Box2,
  ClickableBox,
  Divider,
  Icon,
  ProgressIndicator,
  ScrollView,
  Text,
}

export type Tab<TitleT extends string> = {
  title: TitleT
  text?: string // text to show instead of title
  icon?: IconType
  badgeNumber?: number
}

type Props<TitleT extends string> = {
  tabs: Array<Tab<TitleT>>
  onSelect: (title: TitleT) => void
  selectedTab?: TitleT
  style?: Styles.StylesCrossPlatform
  tabStyle?: Styles.StylesCrossPlatform
  showProgressIndicator?: boolean
  mobileTabModeOverride?: 'scroll' | 'distribute'
}

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Box2 style={styles.tabTextContainer} direction="horizontal">
    <Kb.Text type="BodySmallSemibold" style={selected ? styles.selected : undefined}>
      {text}
    </Kb.Text>
  </Kb.Box2>
)

const Tabs = <TitleT extends string>(props: Props<TitleT>) => {
  const mobileTabMode = Styles.isMobile
    ? props.mobileTabModeOverride ?? (props.tabs.length > 3 ? 'scroll' : 'distribute')
    : undefined
  const tabContent = (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.container,
        mobileTabMode !== 'scroll' && Styles.globalStyles.flexOne,
        mobileTabMode !== 'scroll' && styles.borderBottom,
        props.style,
      ])}
      alignItems="flex-start"
      fullWidth={true}
    >
      {props.tabs.map((tab: Tab<TitleT>) => {
        const selected = props.selectedTab === tab.title
        return (
          <Kb.ClickableBox
            onClick={() => props.onSelect(tab.title)}
            key={tab.title}
            style={Styles.collapseStyles([
              styles.clickableBoxStyle,
              mobileTabMode === 'distribute' ? styles.mobileDistribute : styles.mobileScroll,
            ])}
          >
            <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
              <Kb.Box2
                style={Styles.collapseStyles([styles.tab, selected && styles.selected, props.tabStyle])}
                direction="horizontal"
                centerChildren={true}
              >
                {tab.icon ? (
                  <Kb.Icon type={tab.icon} style={selected ? styles.iconSelected : styles.icon} />
                ) : (
                  <TabText selected={selected} text={tab.text ?? capitalize(tab.title)} />
                )}
                {!!tab.badgeNumber && <Kb.Badge badgeNumber={tab.badgeNumber} badgeStyle={styles.badge} />}
              </Kb.Box2>
              <Kb.Divider style={selected ? styles.dividerSelected : styles.divider} />
            </Kb.Box2>
          </Kb.ClickableBox>
        )
      })}
      {props.showProgressIndicator && <Kb.ProgressIndicator style={styles.progressIndicator} />}
    </Kb.Box2>
  )
  return mobileTabMode === 'scroll' ? (
    <Kb.ScrollView
      horizontal={true}
      contentContainerStyle={Styles.collapseStyles([styles.minWidthFull, styles.borderBottom])}
      alwaysBounceHorizontal={false}
      showsHorizontalScrollIndicator={false}
    >
      {tabContent}
    </Kb.ScrollView>
  ) : (
    tabContent
  )
}

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
  borderBottom: {borderBottomColor: Styles.globalColors.black_10, borderBottomWidth: 1},
  clickableBoxStyle: Styles.platformStyles({
    isElectron: {
      flexShrink: 1,
      height: 40,
      width: 120,
    },
    isMobile: {
      height: 48,
    },
  }),
  container: {
    backgroundColor: Styles.globalColors.white,
    borderStyle: 'solid',
    marginTop: Styles.globalMargins.tiny,
  },
  divider: {
    ...Styles.globalStyles.flexBoxRow,
    backgroundColor: Styles.globalColors.transparent,
    minHeight: 2,
  },
  dividerSelected: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      backgroundColor: Styles.globalColors.blue,
      minHeight: 2,
    },
    isMobile: {minHeight: 3},
  }),
  icon: {
    alignSelf: 'center',
  },
  iconSelected: {
    alignSelf: 'center',
    color: Styles.globalColors.black,
  },
  minWidthFull: {minWidth: '100%'},
  mobileDistribute: Styles.platformStyles({isMobile: {flex: 1}}),
  mobileScroll: Styles.platformStyles({isMobile: {width: 120}}),
  progressIndicator: {
    height: 17,
    width: 17,
  },
  selected: {
    color: Styles.globalColors.black,
  },
  tab: {
    flex: 1,
  },
  tabTextContainer: {justifyContent: 'center'},
}))

export default Tabs
