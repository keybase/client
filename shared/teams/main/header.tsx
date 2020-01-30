import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type HeaderButtonProps = {
  iconType: Kb.IconType
  label: string
  onClick: () => void
}

const marginHorizontal = Styles.isMobile ? 0 : Styles.globalMargins.medium
const headerButtonBoxStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  marginLeft: marginHorizontal,
  marginRight: marginHorizontal,
} as const

const HeaderButton = (props: HeaderButtonProps) => (
  <Kb.ClickableBox onClick={props.onClick} style={headerButtonBoxStyle}>
    <Kb.Icon
      type={Kb.Icon.makeFastType(props.iconType)}
      color={Styles.globalColors.blue}
      fontSize={Styles.isMobile ? 20 : 16}
    />
    <Kb.Text type="BodyBigLink" style={{margin: Styles.globalMargins.tiny}}>
      {props.label}
    </Kb.Text>
  </Kb.ClickableBox>
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
  <Kb.Box2
    gap="small"
    direction="horizontal"
    style={{
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      height: 48,
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    }}
  >
    {/* Put progress indicator in the footer (./index.js) on mobile because it won't fit in the header on small screens */}
    {!Styles.isMobile && !props.loaded && (
      <Kb.ProgressIndicator style={{left: 12, position: 'absolute', top: 12, width: 20}} />
    )}
    <HeaderButton iconType={Kb.IconType.iconfont_new} label="Create a team" onClick={props.onCreateTeam} />
    <HeaderButton iconType={Kb.IconType.iconfont_team_join} label="Join a team" onClick={props.onJoinTeam} />
  </Kb.Box2>
)

const HeaderRightActions = (props: Props) => (
  <Kb.Box2
    gap="tiny"
    direction="horizontal"
    alignItems="center"
    style={Styles.platformStyles({
      common: {marginBottom: Styles.globalMargins.xtiny, paddingRight: Styles.globalMargins.small},
      isElectron: {...Styles.desktopStyles.windowDraggingClickable},
    })}
  >
    <Kb.Button label="Create a team" onClick={props.onCreateTeam} small={true} />
    <Kb.Button label="Join a team" onClick={props.onJoinTeam} small={true} type="Default" mode="Secondary" />
  </Kb.Box2>
)

export {HeaderRightActions}
export default Header
