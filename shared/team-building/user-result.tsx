import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Types from '../constants/types/team-building'
import {followingStateToStyle} from '../search/shared'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceMapToArray} from './shared'

/*
 * User Result can be in several layout states depending on the context in which it is rendered
 *
 * 1. Team Building > "A Keybase User" (desktop) or Team Building > "Keybase & Contacts" (mobile)
 *    State 1: The user is a keybase user
 *    State 2:
 *
 * 2. Team Building > Any other service tab
 */
export type Props = {
  // They are already a member in the actual team, not this temporary set.
  isPreExistingTeamMember: boolean
  resultForService: Types.ServiceIdWithContact
  username: string
  prettyName: string
  displayLabel: string
  services: {[K in Types.ServiceIdWithContact]?: string}
  inTeam: boolean
  followingState: Types.FollowingState
  highlight: boolean
  onAdd: () => void
  onRemove: () => void
}

// Desktop hover styling
const realCSS = (inTeam: boolean) => `
    .hoverRow${inTeam ? 'inTeam' : ''}:hover { background-color: ${Styles.globalColors.blueLighter2};}
`

// TODO
// * Use ListItem2

/*
 * Case 1: the service is 'keybase' (isKeybaseResult = true)
 *
 *    Top: "{keybaseUsername}" (with following state color)
 *    Bottom: "{prettyName} • {services icons}"
 *
 * Case 2: the service is not keybase
 *
 *    Top: "{serviceUsername}"
 *    Bottom: "{keybaseUsername} • {prettyName} • {services icons}"
 *
 *    {keybaseUsername} if the user is also a keybase user
 *    {prettyName} if the user added it
 *    {service icons} if the user has proofs
 */
const UserResult = (props: Props) => {
  /*
   * Regardless of the service that is being searched, if we find that a
   * service user is also a keybase user, we also want to show their keybase
   * username, other services, and full name.
   */
  const isKeybaseResult = props.resultForService === 'keybase'
  const keybaseUsername: string | null = props.services['keybase'] || null
  const serviceUsername = props.services[props.resultForService]
  const onAdd = !props.isPreExistingTeamMember ? props.onAdd : undefined
  const onRemove = !props.isPreExistingTeamMember ? props.onRemove : undefined

  return (
    <Kb.ClickableBox onClick={props.inTeam ? onRemove : onAdd}>
      <Kb.Box2
        className={Styles.classNames({
          hoverRow: !props.inTeam,
          hoverRowinTeam: props.inTeam,
        })}
        direction="horizontal"
        fullWidth={true}
        centerChildren={true}
        style={styles.rowContainer}
      >
        {!Styles.isMobile && <Kb.DesktopStyle style={realCSS(props.inTeam)} />}
        <Avatar resultForService={props.resultForService} keybaseUsername={keybaseUsername} />
        <Kb.Box2 direction="vertical" style={styles.username}>
          {serviceUsername ? (
            <>
              <Username
                followingState={props.followingState}
                isKeybaseResult={isKeybaseResult}
                keybaseUsername={keybaseUsername}
                username={serviceUsername || ''}
              />
              <BottomRow
                displayLabel={props.displayLabel}
                followingState={props.followingState}
                isKeybaseResult={isKeybaseResult}
                isPreExistingTeamMember={props.isPreExistingTeamMember}
                keybaseUsername={keybaseUsername}
                prettyName={props.prettyName}
                services={props.services}
                username={serviceUsername || ''}
              />
            </>
          ) : (
            <>
              <Kb.Text type="BodySemibold" lineClamp={2} style={styles.contactName}>
                {props.prettyName}
              </Kb.Text>
              {!!props.displayLabel && props.displayLabel !== props.prettyName && (
                <Kb.Text type="BodySmall" lineClamp={1}>
                  {props.displayLabel}
                </Kb.Text>
              )}
            </>
          )}
        </Kb.Box2>
        {!props.isPreExistingTeamMember && (
          <ActionButton inTeam={props.inTeam} onAdd={props.onAdd} onRemove={props.onRemove} />
        )}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const AvatarSize = 48
const dotSeparator = '•'

const isPreExistingTeamMemberText = (prettyName: string) =>
  `${prettyName ? prettyName + ` ${dotSeparator} ` : ''} Already in team`

const textWithConditionalSeparator = (text: string, conditional: boolean) =>
  `${text}${conditional ? ` ${dotSeparator}` : ''}`

const Avatar = ({
  resultForService,
  keybaseUsername,
}: {
  keybaseUsername: string | null
  resultForService: Types.ServiceIdWithContact
}) => {
  if (keybaseUsername) {
    return <Kb.Avatar size={AvatarSize} username={keybaseUsername} />
  } else if (resultForService === 'keybase' || Types.isContactServiceId(resultForService)) {
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

const ServicesIconList = (props: {services: Array<Types.ServiceIdWithContact>}) => (
  <Kb.Box2 direction="horizontal">
    {props.services.map(service => (
      <Kb.WithTooltip key={service} tooltip={service} position="top center">
        <Kb.Icon
          fontSize={14}
          type={serviceIdToIconFont(service)}
          style={Styles.isMobile && Kb.iconCastPlatformStyles(styles.serviceIcon)}
          boxStyle={!Styles.isMobile && Kb.iconCastPlatformStyles(styles.serviceIcon)}
        />
      </Kb.WithTooltip>
    ))}
  </Kb.Box2>
)

const FormatPrettyName = (props: {
  displayLabel: string
  prettyName: string
  services: Array<Types.ServiceIdWithContact>
}) =>
  props.prettyName ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.services}>
      <Kb.Text type="BodySmall">
        {textWithConditionalSeparator(props.prettyName, !!props.services.length)}
      </Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.services}>
      <Kb.Text type="BodySmall">
        {textWithConditionalSeparator(props.displayLabel, !!props.services.length)}
      </Kb.Text>
    </Kb.Box2>
  )

const BottomRow = (props: {
  isKeybaseResult: boolean
  username: string
  isPreExistingTeamMember: boolean
  keybaseUsername: string | null
  followingState: Types.FollowingState
  displayLabel: string
  prettyName: string
  services: {[K in Types.ServiceIdWithContact]?: string}
}) => {
  const keybaseUsernameComponent =
    !props.isKeybaseResult && props.keybaseUsername ? (
      <>
        <Kb.Text
          type="BodySemibold"
          style={followingStateToStyle(props.keybaseUsername ? props.followingState : 'NoState')}
        >
          {props.keybaseUsername}
        </Kb.Text>
        <Kb.Text type="BodySmall">{` ${dotSeparator} `} </Kb.Text>
      </>
    ) : null

  return (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start">
      {keybaseUsernameComponent}
      {props.isPreExistingTeamMember ? (
        <Kb.Text type="BodySmall" lineClamp={1}>
          {isPreExistingTeamMemberText(props.prettyName)}
        </Kb.Text>
      ) : (
        <Kb.Box2 direction="horizontal">
          <FormatPrettyName
            displayLabel={props.displayLabel}
            prettyName={props.prettyName}
            services={serviceMapToArray(props.services)}
          />
          <ServicesIconList services={serviceMapToArray(props.services)} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const Username = (props: {
  followingState: Types.FollowingState
  isKeybaseResult: boolean
  keybaseUsername: string | null
  username: string
}) => (
  <Kb.Text
    type="BodySemibold"
    style={followingStateToStyle(
      props.isKeybaseResult && props.keybaseUsername ? props.followingState : 'NoState'
    )}
  >
    {props.username}
  </Kb.Text>
)

const ActionButton = (props: {inTeam: boolean; onAdd: () => void; onRemove: () => void}) => {
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
const styles = Styles.styleSheetCreate(() => ({
  actionButton: Styles.platformStyles({
    common: {
      height: ActionButtonSize,
      marginLeft: Styles.globalMargins.tiny,
      width: ActionButtonSize,
    },
    isMobile: {
      marginRight: Styles.globalMargins.small,
    },
  }),
  addToTeamIcon: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    width: ActionButtonSize,
  },
  contactName: {
    lineHeight: 22,
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
}))

export default UserResult
