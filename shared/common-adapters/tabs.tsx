import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import ClickableBox from './clickable-box'
import Divider from './divider'

const Kb = {
  Box,
  ClickableBox,
  Divider,
}

type Props = {
  clickableBoxStyle?: any
  tabs: Array<React.ReactNode>
  selected: React.ReactNode
  onSelect: (s: React.ReactNode) => any
  style?: any
  tabStyle?: any
}

const Tabs = ({clickableBoxStyle, tabs, selected, onSelect, style, tabStyle}: Props) => {
  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, style])}>
      {tabs.map((t, idx) => {
        // @ts-ignore
        const key: string = (t && t.key) || idx
        return (
          <Kb.ClickableBox onClick={() => onSelect(t)} key={key} style={clickableBoxStyle}>
            <Kb.Box style={styles.tabContainer}>
              <Kb.Box
                style={Styles.collapseStyles([styles.tab, t === selected && styles.tabSelected, tabStyle])}
              >
                {t}
              </Kb.Box>
              <Kb.Divider
                style={Styles.collapseStyles([
                  styles.divider,
                  {
                    backgroundColor:
                      t === selected ? Styles.globalColors.blue : Styles.globalColors.transparent,
                  },
                ])}
              />
            </Kb.Box>
          </Kb.ClickableBox>
        )
      })}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
    flex: 1,
    maxHeight: Styles.isMobile ? 48 : 40,
    width: '100%',
  },
  divider: {
    ...Styles.globalStyles.flexBoxRow,
    minHeight: 2,
  },
  tab: {
    flex: 1,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  tabContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
    },
    isElectron: {
      height: 40,
    },
    isMobile: {
      height: 48,
    },
  }),
  tabSelected: {
    color: Styles.globalColors.black,
  },
}))

export default Tabs
