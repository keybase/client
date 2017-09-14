// @flow
import * as React from 'react'
import Box from './box'
import ClickableBox from './clickable-box'
import Divider from './divider'
import {globalColors, globalStyles} from '../styles'

type Props = {
  tabs: Array<React.Node>,
  selected: React.Node,
  onSelect: (s: React.Node) => void,
  style: any,
}

const Tabs = ({tabs, selected, onSelect, style}: Props) => {
  return (
    <Box style={style}>
      {tabs.map((t, idx) => {
        // $FlowIssue
        const key: string = (t && t.key) || idx
        return (
          <ClickableBox onClick={() => onSelect(t)} key={key}>
            <Box style={globalStyles.flexBoxColumn}>
              {t}
              <Divider
                style={{
                  backgroundColor: t === selected ? globalColors.blue : globalColors.transparent,
                  height: 2,
                }}
              />
            </Box>
          </ClickableBox>
        )
      })}
    </Box>
  )
}

export default Tabs
