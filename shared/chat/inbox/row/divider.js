// @flow
import * as React from 'react'
import {ClickableBox, Icon, Box} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'

type DividerProps = {
  isExpanded: boolean,
  isBadged: boolean,
  toggle: () => void,
}

// TODO hover color

const Divider = ({isExpanded, isBadged, toggle}: DividerProps) => (
  <ClickableBox onClick={toggle}>
    <Box style={_boxStyle}>
      <Box style={_iconStyle}>
        <Icon type={isExpanded ? 'iconfont-keybase' : 'iconfont-down-arrow'} />
      </Box>
    </Box>
  </ClickableBox>
)

const _boxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderStyle: 'solid',
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  height: 16,
  justifyContent: 'space-between',
  position: 'relative',
}

const _iconStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'center',
}

export default Divider
