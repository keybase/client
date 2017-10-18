// @flow
import * as React from 'react'
import {ClickableBox, Icon, Box, Badge} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'
import {BigTeamsLabel} from '../big-teams-label'

type Props = {
  badgeCount: number,
  toggle: () => void,
}

const DividerBox = glamorous(Box)({
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? {}
    : {
        ':hover': {
          borderBottomColor: globalColors.black_10,
          borderTopColor: globalColors.black_10,
          color: globalColors.black_40,
        },
        color: globalColors.black_20,
      }),
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderStyle: 'solid',
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  height: '100%',
  justifyContent: 'flex-start',
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  position: 'relative',
  width: '100%',
})

const FloatingDivider = ({toggle, badgeCount}: Props) => (
  <ClickableBox onClick={toggle} style={_floatingStyle}>
    <DividerBox>
      <BigTeamsLabel isFiltered={false} />
      {badgeCount > 0 && <Badge badgeStyle={_badgeStyle} badgeNumber={badgeCount} />}
      <Box style={_iconStyle}>
        <Icon type="iconfont-up-arrow" inheritColor={true} style={{fontSize: isMobile ? 20 : 16}} />
      </Box>
    </DividerBox>
  </ClickableBox>
)

const _badgeStyle = {
  marginLeft: globalMargins.xtiny,
  marginRight: 0,
  position: 'relative',
}

const _floatingStyle = {
  ...globalStyles.fillAbsolute,
  backgroundColor: isMobile ? globalColors.white : globalColors.blue5,
  flexShrink: 0,
  height: isMobile ? 56 : 32,
  top: undefined,
}

const _iconStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'center',
  marginTop: isMobile ? globalMargins.tiny : 0,
}

export {FloatingDivider, BigTeamsLabel}
