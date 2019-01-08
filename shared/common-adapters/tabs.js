// @flow
import * as React from 'react'
import Box from './box'
import ClickableBox from './clickable-box'
import Divider from './divider'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../styles'

type Props = {
  clickableBoxStyle?: any,
  tabs: Array<React.Node>,
  selected: React.Node,
  onSelect: (s: React.Node) => any,
  style?: any,
  tabStyle?: any,
}

const Tabs = ({clickableBoxStyle, tabs, selected, onSelect, style, tabStyle}: Props) => {
  return (
    <Box style={collapseStyles([styles.container, style])}>
      {tabs.map((t, idx) => {
        // $FlowIssue
        const key: string = (t && t.key) || idx
        return (
          <ClickableBox onClick={() => onSelect(t)} key={key} style={clickableBoxStyle}>
            <Box style={styles.tabContainer}>
              <Box style={collapseStyles([styles.tab, t === selected && styles.tabSelected, tabStyle])}>
                {t}
              </Box>
              <Divider
                style={collapseStyles([
                  styles.divider,
                  {
                    backgroundColor: t === selected ? globalColors.blue : globalColors.transparent,
                  },
                ])}
              />
            </Box>
          </ClickableBox>
        )
      })}
    </Box>
  )
}

const styles = styleSheetCreate({
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    borderBottomColor: globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
    flex: 1,
    maxHeight: isMobile ? 48 : 40,
    width: '100%',
  },
  divider: {
    ...globalStyles.flexBoxRow,
    minHeight: 2,
  },
  tab: {
    flex: 1,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.small,
  },
  tabContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
    },
    isElectron: {
      height: 40,
    },
    isMobile: {
      height: 48,
    },
  }),
  tabSelected: {
    color: globalColors.black_75,
  },
})

export default Tabs
