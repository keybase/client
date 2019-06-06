import * as React from 'react'
import {ClickableBox, Box2, Button, Icon, ProgressIndicator, Text, IconType} from '../../common-adapters'
import {
  desktopStyles,
  platformStyles,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
} from '../../styles'

export type HeaderButtonProps = {
  iconType: IconType
  label: string
  onClick: () => void
}

const marginHorizontal = isMobile ? 0 : globalMargins.medium
const headerButtonBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginLeft: marginHorizontal,
  marginRight: marginHorizontal,
} as const

const HeaderButton = (props: HeaderButtonProps) => (
  <ClickableBox onClick={props.onClick} style={headerButtonBoxStyle}>
    <Icon type={props.iconType} color={globalColors.blue} fontSize={isMobile ? 20 : 16} />
    <Text type="BodyBigLink" style={{margin: globalMargins.tiny}}>
      {props.label}
    </Text>
  </ClickableBox>
)

export type Props = {
  onCreateTeam: () => void
  onJoinTeam: () => void
}

const Header = (
  props: Props & {
    loaded: boolean
  }
) => (
  <Box2
    gap="small"
    direction="horizontal"
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      borderBottomColor: globalColors.black_10,
      borderBottomWidth: 1,
      height: 48,
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    }}
  >
    {/* Put progress indicator in the footer (./index.js) on mobile because it won't fit in the header on small screens */}
    {!isMobile && !props.loaded && (
      <ProgressIndicator style={{left: 12, position: 'absolute', top: 12, width: 20}} />
    )}
    <HeaderButton iconType="iconfont-new" label="Create a team" onClick={props.onCreateTeam} />
    <HeaderButton iconType="iconfont-team-join" label="Join a team" onClick={props.onJoinTeam} />
  </Box2>
)

const HeaderRightActions = (props: Props) => (
  <Box2
    gap="tiny"
    direction="horizontal"
    alignItems="center"
    style={platformStyles({
      common: {marginBottom: globalMargins.xtiny, paddingRight: globalMargins.small},
      isElectron: {...desktopStyles.windowDraggingClickable},
    })}
  >
    <Button label="Create a team" onClick={props.onCreateTeam} small={true} />
    <Button label="Join a team" onClick={props.onJoinTeam} small={true} type="Default" mode="Secondary" />
  </Box2>
)

export {HeaderRightActions}
export default Header
