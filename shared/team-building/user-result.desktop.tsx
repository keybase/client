import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Types from '../constants/types/team-building'
import {followingStateToStyle} from '../search/shared'
import {Props} from './user-result'
import {serviceIdToIconFont, serviceIdToAccentColor} from './shared'

// TODO
// * Use ListItem2
// * maybe move realCSS up?

const realCSS = (inTeam: boolean) => `
    .hoverRow${inTeam ? 'inTeam' : ''}:hover { background-color: ${Styles.globalColors.blueLighter2};}
    .hoverRow${inTeam ? 'inTeam' : ''}:hover .actionButton * { color: ${
  Styles.globalColors.white
} !important;}
    .hoverRow${inTeam ? 'inTeam' : ''}:hover .actionButton { background-color: ${
  inTeam ? Styles.globalColors.red : Styles.globalColors.blue
} !important;}
`

type LocalState = {
  hovering: boolean
}

class Row extends React.Component<Props, LocalState> {
  state = {hovering: false}

  render = () => {
    const keybaseResult = this.props.resultForService === 'keybase'
    const keybaseUsername: string | null = this.props.services['keybase'] || null
    const serviceUsername = this.props.services[this.props.resultForService]
    const onAdd = !this.props.isPreExistingTeamMember ? this.props.onAdd : undefined
    const onRemove = !this.props.isPreExistingTeamMember ? this.props.onRemove : undefined

    return (
      <Kb.ClickableBox onClick={this.props.inTeam ? onRemove : onAdd}>
        <Kb.Box2
          onMouseOver={() => {
            this.setState({hovering: true})
          }}
          onMouseLeave={() => {
            this.setState({hovering: false})
          }}
          className={Styles.classNames({
            hoverRow: !this.props.inTeam,
            hoverRowinTeam: this.props.inTeam,
          })}
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          style={Styles.collapseStyles([
            styles.rowContainer,
            this.props.highlight ? styles.highlighted : null,
          ])}
        >
          <Kb.DesktopStyle style={realCSS(this.props.inTeam)} />
          <Avatar resultForService={this.props.resultForService} keybaseUsername={keybaseUsername} />
          <Username
            isPreExistingTeamMember={this.props.isPreExistingTeamMember}
            keybaseResult={keybaseResult}
            username={serviceUsername || ''}
            prettyName={this.props.prettyName}
            followingState={this.props.followingState}
          />
          <Services
            keybaseResult={keybaseResult}
            services={this.props.services}
            keybaseUsername={keybaseUsername}
            followingState={this.props.followingState}
          />
          {!this.props.isPreExistingTeamMember && (
            <ActionButton
              inTeam={this.props.inTeam}
              onAdd={this.props.onAdd}
              onRemove={this.props.onRemove}
              highlight={this.props.highlight}
              hover={this.state.hovering}
            />
          )}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

const AvatarSize = 32
const Avatar = ({
  resultForService,
  keybaseUsername,
}: {
  keybaseUsername: string | null
  resultForService: Types.ServiceIdWithContact
}) => {
  if (keybaseUsername) {
    return <Kb.Avatar size={AvatarSize} username={keybaseUsername} />
  }

  return (
    <Kb.Icon
      fontSize={AvatarSize}
      type={serviceIdToIconFont(resultForService)}
      colorOverride={serviceIdToAccentColor(resultForService)}
    />
  )
}

const isPreExistingTeamMemberText = (prettyName: string) =>
  `${prettyName || ''}${prettyName ? ' • ' : ''} Already in team`

const Username = (props: {
  username: string
  prettyName: string
  isPreExistingTeamMember?: boolean
  followingState: Types.FollowingState
  keybaseResult: boolean
}) => (
  <Kb.Box2 direction="vertical" style={styles.username}>
    <Kb.Text
      type="BodySemibold"
      style={followingStateToStyle(props.keybaseResult ? props.followingState : 'NoState')}
    >
      {props.username}
    </Kb.Text>
    {props.isPreExistingTeamMember ? (
      <Kb.Text type="BodySmall">{isPreExistingTeamMemberText(props.prettyName)}</Kb.Text>
    ) : (
      !!props.prettyName && <Kb.Text type="BodySmall">{props.prettyName}</Kb.Text>
    )}
  </Kb.Box2>
)

const Services = ({
  services,
  keybaseResult,
  keybaseUsername,
  followingState,
}: {
  services: {[K in Types.ServiceIdWithContact]?: string}
  keybaseResult: boolean
  keybaseUsername: string | null
  followingState: Types.FollowingState
}) => {
  if (keybaseResult) {
    return (
      <Kb.Box2 direction="horizontal" style={styles.services}>
        {Object.keys(services)
          .filter(s => s !== 'keybase')
          .map(service => (
            <Kb.WithTooltip key={service} text={services[service]} position="top center">
              <Kb.Icon
                type={serviceIdToIconFont(service as Types.ServiceIdWithContact)}
                style={Kb.iconCastPlatformStyles(styles.serviceIcon)}
              />
            </Kb.WithTooltip>
          ))}
      </Kb.Box2>
    )
  } else if (keybaseUsername) {
    return (
      <Kb.Box2 direction="horizontal" style={styles.services}>
        <Kb.Icon type={'icon-keybase-logo-16'} style={Kb.iconCastPlatformStyles(styles.keybaseServiceIcon)} />
        <Kb.Text type="BodySemibold" style={followingStateToStyle(followingState)}>
          {keybaseUsername}
        </Kb.Text>
      </Kb.Box2>
    )
  }

  return null
}

const ActionButton = (props: {
  highlight: boolean
  hover: boolean
  inTeam: boolean
  onAdd: () => void
  onRemove: () => void
}) => {
  let Icon = props.inTeam ? AlreadyAddedIconButton : AddButton

  if (props.highlight) {
    Icon = props.inTeam ? RemoveButton : AddButtonHover
  } else if (props.hover) {
    Icon = props.inTeam ? RemoveButton : AddButton
  }

  return (
    <Kb.ClickableBox onClick={props.inTeam ? props.onRemove : props.onAdd}>
      <Kb.Box2
        className="actionButton"
        direction="vertical"
        centerChildren={true}
        style={Styles.collapseStyles([
          styles.actionButton,
          props.inTeam && {backgroundColor: null},
          props.highlight && {
            backgroundColor: props.inTeam ? Styles.globalColors.red : Styles.globalColors.blue,
          },
        ])}
      >
        <Icon />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const AddButton = () => <Kb.Icon type="iconfont-new" fontSize={16} color={Styles.globalColors.black} />

const AddButtonHover = () => (
  <Kb.Box2 direction="vertical" centerChildren={true} style={styles.addToTeamIcon}>
    <Kb.Icon type="iconfont-return" fontSize={16} color={Styles.globalColors.white} />
  </Kb.Box2>
)

const RemoveButton = () => (
  <Kb.Box2 direction="vertical" centerChildren={true} style={styles.removeButton}>
    <Kb.Icon type="iconfont-close" fontSize={16} color={Styles.globalColors.white} />
  </Kb.Box2>
)

const AlreadyAddedIconButton = () => (
  <Kb.Icon type="iconfont-check" fontSize={16} color={Styles.globalColors.blue} />
)

const ActionButtonSize = 32
const styles = Styles.styleSheetCreate({
  actionButton: {
    ...Styles.globalStyles.rounded,
    backgroundColor: Styles.globalColors.grey,
    height: ActionButtonSize,
    marginLeft: Styles.globalMargins.tiny,
    width: ActionButtonSize,
  },
  actionButtonHighlight: {
    backgroundColor: Styles.globalColors.blue,
  },
  actionButtonHoverContainer: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    justifyContent: 'center',
    width: ActionButtonSize,
  },
  addToTeamIcon: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    width: ActionButtonSize,
  },
  highlighted: {
    backgroundColor: Styles.globalColors.blueLighter2,
    borderRadius: Styles.borderRadius,
  },
  keybaseServiceIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  removeButton: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    width: ActionButtonSize,
  },
  removeButtonHighlight: {
    backgroundColor: Styles.globalColors.red,
  },
  rowContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
    height: 50,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  serviceIcon: {
    marginLeft: Styles.globalMargins.tiny,
    height: 18,
    width: 18,
  },
  services: {
    justifyContent: 'flex-end',
  },
  username: {
    flex: 1,
    marginLeft: Styles.globalMargins.small,
  },
})

export default Row
