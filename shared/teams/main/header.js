// @flow
import * as React from 'react'
import {ClickableBox, Box2, Icon, ProgressIndicator, Text, type IconType} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

export type HeaderButtonProps = {
  iconType: IconType,
  label: string,
  onClick: () => void,
}

const marginHorizontal = isMobile ? 0 : globalMargins.medium
const headerButtonBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginLeft: marginHorizontal,
  marginRight: marginHorizontal,
}

const HeaderButton = (props: HeaderButtonProps) => (
  <ClickableBox onClick={props.onClick} style={headerButtonBoxStyle}>
    <Icon type={props.iconType} color={globalColors.blue} fontSize={isMobile ? 20 : 16} />
    <Text type="BodyBigLink" style={{margin: globalMargins.tiny}}>
      {props.label}
    </Text>
  </ClickableBox>
)

export type Props = {
  loaded: boolean,
  onCreateTeam: () => void,
  onJoinTeam: () => void,
}

const Header = (props: Props) => (
  <Box2
    gap="small"
    direction="horizontal"
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomColor: globalColors.black_10,
      borderBottomWidth: 1,
      height: 48,
      position: 'relative',
      width: '100%',
    }}
  >
    {/* Put progress indicator in the footer (./index.js) on mobile because it won't fit in the header on small screens */}
    {!isMobile &&
      !props.loaded && <ProgressIndicator style={{position: 'absolute', width: 20, top: 12, left: 12}} />}
    <HeaderButton iconType="iconfont-new" label="Create a team" onClick={props.onCreateTeam} />
    <HeaderButton iconType="iconfont-team-join" label="Join a team" onClick={props.onJoinTeam} />
  </Box2>
)

export default Header
