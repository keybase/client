// @flow
import * as React from 'react'
import {ClickableBox, Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'

import type {IconType} from '../../common-adapters/icon.constants'

export type HeaderButtonProps = {
  iconType: IconType,
  label: string,
  onClick: () => void,
}

const marginHorizontal = isMobile ? globalMargins.tiny : globalMargins.medium
const headerButtonBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginLeft: marginHorizontal,
  marginRight: marginHorizontal,
}

const HeaderButton = (props: HeaderButtonProps) => (
  <ClickableBox onClick={props.onClick} style={headerButtonBoxStyle}>
    <Icon type={props.iconType} style={{color: globalColors.blue}} />
    <Text type={isMobile ? 'BodySemiboldLink' : 'HeaderLink'} style={{margin: globalMargins.tiny}}>
      {props.label}
    </Text>
  </ClickableBox>
)

export type Props = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
}

const Header = (props: Props) => (
  <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 48}}>
    <HeaderButton iconType="iconfont-new" label="Create a team" onClick={props.onCreateTeam} />
    {false && <HeaderButton iconType="iconfont-team-join" label="Join a team" onClick={props.onJoinTeam // off until join works
        } />}
  </Box>
)

export default Header
