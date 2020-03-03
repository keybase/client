import * as React from 'react'
import * as Styles from '../styles'
import Badge from './badge'
import ClickableBox from './clickable-box'
import Divider from './divider'
import Icon, {IconType} from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {Box, Box2} from './box'
import capitalize from 'lodash/capitalize'

const Kb = {
  Badge,
  Box,
  Box2,
  ClickableBox,
  Divider,
  Icon,
  ProgressIndicator,
  Text,
}

export type Tab<TitleT extends string> = {
  title: TitleT
  text?: string // text to show instead of title
  icon?: IconType
  badgeNumber?: number
}

type Props<TitleT extends string> = {
  clickableBoxStyle?: Styles.StylesCrossPlatform
  tabs: Array<Tab<TitleT>>
  onSelect: (title: TitleT, idx: number) => void
  selectedTab?: TitleT
  style?: Styles.StylesCrossPlatform
  tabStyle?: Styles.StylesCrossPlatform
  showProgressIndicator?: boolean
}

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Box2 style={styles.tabTextContainer} direction="horizontal">
    <Kb.Text type="BodySmallSemibold" style={selected ? styles.selected : undefined}>
      {text}
    </Kb.Text>
  </Kb.Box2>
)

function Tabs<TitleT extends string>(props: Props<TitleT>) {
  return (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.container, props.style])}
      alignItems="flex-start"
      fullWidth={true}
    >
      {props.tabs.map((tab: Tab<TitleT>, idx: number) => {
        const selected = props.selectedTab === tab.title
        return (
          <Kb.ClickableBox
            onClick={() => props.onSelect(tab.title, idx)}
            key={tab.title}
            style={props.clickableBoxStyle}
          >
            <Kb.Box2 direction="vertical" style={styles.tabContainer} fullWidth={true}>
              <Kb.Box
                style={Styles.collapseStyles([styles.tab, selected && styles.selected, props.tabStyle])}
              >
                {tab.icon ? (
                  <Kb.Icon type={tab.icon} style={selected ? styles.iconSelected : styles.icon} />
                ) : (
                  <TabText selected={selected} text={tab.text ?? capitalize(tab.title)} />
                )}
                {!!tab.badgeNumber && <Kb.Badge badgeNumber={tab.badgeNumber} badgeStyle={styles.badge} />}
              </Kb.Box>
              <Kb.Divider style={selected ? styles.dividerSelected : styles.divider} />
            </Kb.Box2>
          </Kb.ClickableBox>
        )
      })}
      {props.showProgressIndicator && <Kb.ProgressIndicator style={styles.progressIndicator} />}
    </Kb.Box2>
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
  container: {
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
    flex: 1,
    maxHeight: Styles.isMobile ? 48 : 40,
  },
  divider: {
    ...Styles.globalStyles.flexBoxRow,
    minHeight: 2,
    backgroundColor: Styles.globalColors.transparent,
  },
  dividerSelected: {
    ...Styles.globalStyles.flexBoxRow,
    minHeight: 2,
    backgroundColor: Styles.globalColors.blue,
  },
  tab: {
    flex: 1,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  tabContainer: Styles.platformStyles({
    isElectron: {
      height: 40,
    },
    isMobile: {
      height: 48,
    },
  }),
  tabTextContainer: {justifyContent: 'center'},
  icon: {
    alignSelf: 'center',
  },
  iconSelected: {
    alignSelf: 'center',
    color: Styles.globalColors.black,
  },
  progressIndicator: {
    height: 17,
    width: 17,
  },
  selected: {
    color: Styles.globalColors.black,
  },
}))

export default Tabs
