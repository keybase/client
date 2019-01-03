// @flow
import React from 'react'
import * as Kb from '../common-adapters'
import {isMobile} from '../constants/platform'
import * as Styles from '../styles'
import {followingStateToStyle} from '../search/shared'
import {serviceIdToIconFont, serviceIdToAccentColor} from './shared'
import type {ServiceIdWithContact, FollowingState} from '../constants/types/team-building'

// TODO
// * Add service icons and colors
// * style
// * style for mobile
// * Use ListItem2
// * maybe move realCSS up?

export type Props = {
  resultForService: ServiceIdWithContact,
  username: string,
  prettyName: string,
  services: {[key: ServiceIdWithContact]: string},
  inTeam: boolean,
  followingState: FollowingState,
  highlight: boolean,
  onAdd: () => void,
  onRemove: () => void,
}

const realCSS = (inTeam: boolean) => `
    .hoverRow${inTeam ? 'inTeam' : ''}:hover { background-color: ${Styles.globalColors.blue4};}
    .hoverRow${inTeam ? 'inTeam' : ''}:hover .actionButton * { color: ${
  Styles.globalColors.white
} !important;}
    .hoverRow${inTeam ? 'inTeam' : ''}:hover .actionButton { background-color: ${
  inTeam ? Styles.globalColors.red : Styles.globalColors.blue
} !important;}
`

type LocalState = {
  hovering: boolean,
}

class Row extends React.Component<Props, LocalState> {
  state = {hovering: false}

  render = () => {
    const keybaseResult = this.props.resultForService === 'keybase'
    const keybaseUsername: ?string = this.props.services['keybase'] || null
    const serviceUsername = this.props.services[this.props.resultForService]

    return (
      <Kb.ClickableBox onClick={this.props.inTeam ? this.props.onRemove : this.props.onAdd}>
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
            keybaseResult={keybaseResult}
            username={serviceUsername}
            prettyName={this.props.prettyName}
            followingState={this.props.followingState}
          />
          <Services
            keybaseResult={keybaseResult}
            services={this.props.services}
            keybaseUsername={keybaseUsername}
            followingState={this.props.followingState}
          />
          <ActionButton
            inTeam={this.props.inTeam}
            onAdd={this.props.onAdd}
            onRemove={this.props.onRemove}
            highlight={this.props.highlight || this.state.hovering}
          />
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

const Avatar = ({
  resultForService,
  keybaseUsername,
}: {
  keybaseUsername: ?string,
  resultForService: ServiceIdWithContact,
}) => {
  if (keybaseUsername) {
    return <Kb.Avatar size={32} username={keybaseUsername} style={{}} />
  }

  return (
    <Kb.Icon
      fontSize={32}
      type={serviceIdToIconFont(resultForService)}
      colorOverride={serviceIdToAccentColor(resultForService)}
    />
  )
}

const Username = (props: {
  username: string,
  prettyName: string,
  followingState: FollowingState,
  keybaseResult: boolean,
}) => (
  <Kb.Box2 direction="vertical" style={styles.username}>
    <Kb.Text
      type="BodySmallSemibold"
      style={followingStateToStyle(props.keybaseResult ? props.followingState : 'NoState')}
    >
      {props.username}
    </Kb.Text>
    <Kb.Text type="BodySmall">{props.prettyName}</Kb.Text>
  </Kb.Box2>
)

const Services = ({
  services,
  keybaseResult,
  keybaseUsername,
  followingState,
}: {
  services: {[key: ServiceIdWithContact]: string},
  keybaseResult: boolean,
  keybaseUsername: ?string,
  followingState: FollowingState,
}) => {
  if (keybaseResult) {
    return (
      <Kb.Box2 direction="horizontal" style={styles.services}>
        {Object.keys(services)
          .filter(s => s !== 'keybase')
          .map(service => (
            <Kb.WithTooltip key={service} text={services[service]} position="top center">
              <Kb.Icon
                type={serviceIdToIconFont(service)}
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
        <Kb.Text type="BodySmallSemibold" style={followingStateToStyle(followingState)}>
          {keybaseUsername}
        </Kb.Text>
      </Kb.Box2>
    )
  }

  return null
}

const ActionButton = (props: {
  highlight: boolean,
  inTeam: boolean,
  onAdd: () => void,
  onRemove: () => void,
}) => {
  const Icon = props.inTeam ? ActionButtonUserInTeam : ActionButtonUserNotInTeam

  return (
    <Kb.ClickableBox onClick={props.inTeam ? props.onRemove : props.onAdd}>
      <Kb.Box2
        className="actionButton"
        direction="vertical"
        centerChildren={true}
        style={Styles.collapseStyles([
          styles.actionButton,
          props.highlight
            ? {backgroundColor: props.inTeam ? Styles.globalColors.red : Styles.globalColors.blue}
            : null,
        ])}
      >
        {props.highlight ? (
          props.inTeam ? (
            <RemoveButton />
          ) : (
            <AddButtonHover />
          )
        ) : (
          <Icon containerStyle={styles.actionButtonHoverContainer} />
        )}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const AddButton = () => <Kb.Icon type="iconfont-new" fontSize={16} color={Styles.globalColors.black_75} />

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
  <Kb.Icon type="iconfont-check" fontSize={16} color={Styles.globalColors.black_75} />
)

const ActionButtonUserInTeam = Kb.HoverHoc(AlreadyAddedIconButton, RemoveButton)
const ActionButtonUserNotInTeam = Kb.HoverHoc(AddButton, AddButtonHover)

// TODO fix size for mobile
const ActionButtonSize = isMobile ? 32 : 32
const styles = Styles.styleSheetCreate({
  actionButton: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.rounded,
      backgroundColor: Styles.globalColors.lightGrey2,
      height: ActionButtonSize,
      marginLeft: Styles.globalMargins.tiny,
      width: ActionButtonSize,
    },
  }),
  actionButtonHighlight: {
    backgroundColor: Styles.globalColors.blue,
  },
  actionButtonHoverContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.rounded,
      height: ActionButtonSize,
      justifyContent: 'center',
      width: ActionButtonSize,
    },
  }),
  addToTeamIcon: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    width: ActionButtonSize,
  },
  highlighted: {
    backgroundColor: Styles.globalColors.blue4,
  },
  keybaseServiceIcon: Styles.platformStyles({
    common: {
      marginRight: Styles.globalMargins.xtiny,
    },
  }),
  removeButton: {
    ...Styles.globalStyles.rounded,
    height: ActionButtonSize,
    width: ActionButtonSize,
  },
  removeButtonHighlight: {
    backgroundColor: Styles.globalColors.red,
  },
  rowContainer: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      height: 50,
    },
  }),
  serviceIcon: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      height: 18,
      width: 18,
    },
  }),
  services: {
    justifyContent: 'flex-end',
  },
  username: {
    flex: 1,
    marginLeft: Styles.globalMargins.tiny,
  },
})

export default Row
