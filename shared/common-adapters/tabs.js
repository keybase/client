// @flow
import * as React from 'react'
import Box from './box'
import ClickableBox from './clickable-box'
import Divider from './divider'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {isMobile} from '../constants/platform'

type Props = {
  tabs: Array<React.Node>,
  selected: React.Node,
  onSelect: (s: React.Node) => any,
  style?: any,
}

const Tabs = ({tabs, selected, onSelect, style}: Props) => {
  return (
    <Box style={{...style, ...containerStyle}}>
      {tabs.map((t, idx) => {
        // $FlowIssue
        const key: string = (t && t.key) || idx
        return (
          <ClickableBox onClick={() => onSelect(t)} key={key}>
            <Box style={{...globalStyles.flexBoxColumn, height: isMobile ? 48 : 40}}>
              <Box
                style={{
                  flex: 1,
                  paddingBottom: globalMargins.xtiny,
                  paddingLeft: globalMargins.small,
                  paddingTop: globalMargins.small,
                  paddingRight: globalMargins.small,
                }}
              >
                {t}
              </Box>
              <Divider
                style={{
                  ...globalStyles.flexBoxRow,
                  backgroundColor: t === selected ? globalColors.blue : globalColors.transparent,
                  minHeight: 2,
                }}
              />
            </Box>
          </ClickableBox>
        )
      })}
    </Box>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  flex: 1,
  maxHeight: isMobile ? 48 : 40,
  width: '100%',
}

export default Tabs
