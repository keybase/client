import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Types from '../constants/types/team-building'
import {followingStateToStyle} from '../search/shared'
import {Props} from './user-result'
import {serviceIdToIconFont, serviceIdToAccentColor} from './shared'

// TODO
// * Use ListItem2

class UserResult extends React.Component<Props> {
  render = () => {
    const keybaseResult = this.props.resultForService === 'keybase'
    const keybaseUsername: string | null = this.props.services['keybase'] || null
    const serviceUsername = this.props.services[this.props.resultForService]
    const onAdd = !this.props.isPreExistingTeamMember ? this.props.onAdd : undefined
    const onRemove = !this.props.isPreExistingTeamMember ? this.props.onRemove : undefined

    return (
      <Kb.ClickableBox onClick={this.props.inTeam ? onRemove : onAdd}>
        <Kb.Box2
          className={Styles.classNames({
            hoverRow: !this.props.inTeam,
            hoverRowinTeam: this.props.inTeam,
          })}
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          style={styles.rowContainer}
        >
          <Avatar resultForService={this.props.resultForService} keybaseUsername={keybaseUsername} />
          <Username
            isPreExistingTeamMember={this.props.isPreExistingTeamMember}
            keybaseResult={keybaseResult}
            keybaseUsername={keybaseUsername}
            displayLabel={this.props.displayLabel}
            username={serviceUsername || ''}
            prettyName={this.props.prettyName}
            followingState={this.props.followingState}
            services={this.props.services}
          />
          {!this.props.isPreExistingTeamMember && (
            <ActionButton
              inTeam={this.props.inTeam}
              onAdd={this.props.onAdd}
              onRemove={this.props.onRemove}
              highlight={this.props.highlight}
            />
          )}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

const AvatarSize = 48
const Avatar = ({
  resultForService,
  keybaseUsername,
}: {
  keybaseUsername: string | null
  resultForService: Types.ServiceIdWithContact
}) => {
  if (keybaseUsername) {
    return <Kb.Avatar size={AvatarSize} username={keybaseUsername} />
  } else if (resultForService === 'keybase' || resultForService === 'contact') {
    return <Kb.Avatar size={AvatarSize} username="invalid username for placeholder avatar" />
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
  `${prettyName ? prettyName + ' • ' : ''} Already in team`

const FormatPrettyName = (props: {
  displayLabel: string
  followingState: Types.FollowingState
  keybaseResult: boolean
  keybaseUsername: string | null
  prettyName: string
  services: [Types.ServiceIdWithContact]
}) =>
  props.keybaseResult ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.services}>
      {props.prettyName && props.prettyName !== props.keybaseUsername ? (
        <Kb.Text type="BodySmall">{props.prettyName + (props.services.length ? ' •' : '')}</Kb.Text>
      ) : (
        !!props.displayLabel && (
          <Kb.Text type="BodySmall">{props.displayLabel + (props.services.length ? ' •' : '')}</Kb.Text>
        )
      )}
      {props.services.map(service => (
        <Kb.WithTooltip key={service} text={service} position="top center">
          <Kb.Icon
            fontSize={14}
            type={serviceIdToIconFont(service)}
            style={Kb.iconCastPlatformStyles(styles.serviceIcon)}
          />
        </Kb.WithTooltip>
      ))}
    </Kb.Box2>
  ) : null

const Username = (props: {
  username: string
  prettyName: string
  displayLabel: string
  isPreExistingTeamMember?: boolean
  followingState: Types.FollowingState
  keybaseResult: boolean
  keybaseUsername: string | null
  services: {[K in Types.ServiceIdWithContact]?: string}
}) => (
  <Kb.Box2 direction="vertical" style={styles.username}>
    {props.username ? (
      <>
        <Kb.Text
          type="BodySemibold"
          style={followingStateToStyle(props.keybaseUsername ? props.followingState : 'NoState')}
        >
          {props.username}
        </Kb.Text>
        {props.isPreExistingTeamMember ? (
          <Kb.Text type="BodySmall" lineClamp={1}>
            {isPreExistingTeamMemberText(props.prettyName)}
          </Kb.Text>
        ) : (
          <FormatPrettyName
            displayLabel={props.displayLabel}
            followingState={props.followingState}
            keybaseResult={props.keybaseResult}
            keybaseUsername={props.keybaseUsername}
            prettyName={props.prettyName}
            services={
              Object.keys(props.services).filter(s => s !== 'keybase') as [Types.ServiceIdWithContact]
            }
          />
        )}
      </>
    ) : (
      <>
        <Kb.Text type="BodySemibold">{props.prettyName}</Kb.Text>
        {!!props.displayLabel && props.displayLabel !== props.prettyName && (
          <Kb.Text type="BodySmall">{props.displayLabel}</Kb.Text>
        )}
      </>
    )}
  </Kb.Box2>
)

const ActionButton = (props: {
  highlight: boolean
  inTeam: boolean
  onAdd: () => void
  onRemove: () => void
}) => {
  const Icon = props.inTeam ? AlreadyAddedIconButton : AddButton

  return (
    <Kb.ClickableBox onClick={props.inTeam ? props.onRemove : props.onAdd}>
      <Kb.Box2
        className="actionButton"
        direction="vertical"
        centerChildren={true}
        style={Styles.collapseStyles([styles.actionButton, props.inTeam && {backgroundColor: null}])}
      >
        <Icon />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const AddButton = () => <Kb.Icon type="iconfont-circle" fontSize={22} color={Styles.globalColors.black_10} />

const AlreadyAddedIconButton = () => (
  <Kb.Icon type="iconfont-success" fontSize={22} color={Styles.globalColors.blue} />
)

const ActionButtonSize = 40
export const userResultHeight = Styles.globalMargins.xlarge
const styles = Styles.styleSheetCreate({
  actionButton: {
    height: ActionButtonSize,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.small,
    width: ActionButtonSize,
  },
  addToTeamIcon: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    width: ActionButtonSize,
  },
  keybaseServiceIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  removeButton: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    width: ActionButtonSize,
  },
  rowContainer: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
    height: userResultHeight,
  },
  serviceIcon: {
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: 1,
  },
  services: {
    justifyContent: 'flex-start',
  },
  username: {
    flex: 1,
    marginLeft: Styles.globalMargins.small,
  },
})

export default UserResult
