// @flow
import React from 'react'
import * as Kb from '../common-adapters'
import {isMobile} from '../constants/platform'
import * as Styles from '../styles'
import {followingStateToStyle} from '../search/shared'
import {serviceIdToLogo14} from './shared'
import type {ServiceIdWithContact, FollowingState} from '../constants/types/team-building'

// TODO
// * Add service icons and colors
// * style
// * style for mobile
// * Use ListItem2
// * maybe move realCSS up?

export type Props = {
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
  Styles.globalColors.blue
} !important;}
    ${
      inTeam
        ? `.hoverRow${inTeam ? 'inTeam' : ''}:hover .actionButton:hover { background-color: ${
            Styles.globalColors.red
          } !important;}`
        : ``
    }
  `

const Row = (props: Props) => (
  <Kb.Box2
    className={`hoverRow${props.inTeam ? 'inTeam' : ''}`}
    direction="horizontal"
    centerChildren={true}
    style={Styles.collapseStyles([styles.rowContainer, props.highlight ? styles.highlighted : null])}
  >
    <Kb.DesktopStyle style={realCSS(props.inTeam)} />
    <Kb.Avatar size={32} username={props.username} style={{}} />
    <Username username={props.username} prettyName={props.prettyName} followingState={props.followingState} />
    <Services services={props.services} />
    <ActionButton
      inTeam={props.inTeam}
      onAdd={props.onAdd}
      onRemove={props.onRemove}
      highlight={props.highlight}
    />
  </Kb.Box2>
)

const Username = (props: {username: string, prettyName: string, followingState: FollowingState}) => (
  <Kb.Box2 direction="vertical" style={styles.username}>
    <Kb.Text type="BodySmallSemibold" style={followingStateToStyle(props.followingState)}>
      {props.username}
    </Kb.Text>
    <Kb.Text type="BodySmall">{props.prettyName}</Kb.Text>
  </Kb.Box2>
)

const Services = ({services}: {services: {[key: ServiceIdWithContact]: string}}) => (
  <Kb.Box2 direction="horizontal" style={styles.services}>
    {Object.keys(services).map(service => (
      <Kb.WithTooltip key={service} text={services[service]} position="top center">
        <Kb.Icon type={serviceIdToLogo14(service)} style={Kb.iconCastPlatformStyles(styles.serviceIcon)} />
      </Kb.WithTooltip>
    ))}
  </Kb.Box2>
)

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

const AddButton = () => <Kb.Icon type="iconfont-new" fontSize={19} color={Styles.globalColors.black_75} />

const AddButtonHover = () => (
  <Kb.Box2 direction="vertical" centerChildren={true} style={styles.addToTeamIcon}>
    <Kb.Icon type="iconfont-arrow-right" fontSize={19} color={Styles.globalColors.white} />
  </Kb.Box2>
)

const RemoveButton = () => (
  <Kb.Box2 direction="vertical" centerChildren={true} style={styles.removeButton}>
    <Kb.Icon type="iconfont-close" fontSize={19} color={Styles.globalColors.white} />
  </Kb.Box2>
)

const AlreadyAddedIconButton = () => (
  <Kb.Icon type="iconfont-check" fontSize={19} color={Styles.globalColors.black_75} />
)

const ActionButtonUserInTeam = Kb.HoverHoc(AlreadyAddedIconButton, RemoveButton)
const ActionButtonUserNotInTeam = Kb.HoverHoc(AddButton, AddButtonHover)

// TODO fix size for mobile
const ACTIONBUTTON_SIZE = isMobile ? 32 : 32
const styles = Styles.styleSheetCreate({
  rowContainer: Styles.platformStyles({
    isElectron: {
      height: 50,
      width: 420,
    },
    common: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
      paddingBottom: Styles.globalMargins.tiny,
    },
  }),

  highlighted: {
    backgroundColor: Styles.globalColors.blue4,
  },

  username: {
    flex: 1,
    marginLeft: Styles.globalMargins.tiny,
  },

  services: {
    justifyContent: 'flex-end',
  },
  serviceIcon: Styles.platformStyles({
    isElectron: {
      height: 18,
      width: 18,
    },
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
  }),

  actionButton: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.rounded,
      backgroundColor: Styles.globalColors.lightGrey2,
      marginLeft: Styles.globalMargins.tiny,
      width: ACTIONBUTTON_SIZE,
      height: ACTIONBUTTON_SIZE,
    },
  }),
  actionButtonHighlight: {
    backgroundColor: Styles.globalColors.blue,
  },
  removeButtonHighlight: {
    backgroundColor: Styles.globalColors.red,
  },

  actionButtonHoverContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.rounded,
      justifyContent: 'center',
      width: ACTIONBUTTON_SIZE,
      height: ACTIONBUTTON_SIZE,
    },
  }),

  removeButton: {
    ...Styles.globalStyles.rounded,
    width: ACTIONBUTTON_SIZE,
    height: ACTIONBUTTON_SIZE,
  },

  addToTeamIcon: {
    ...Styles.globalStyles.rounded,
    width: ACTIONBUTTON_SIZE,
    height: ACTIONBUTTON_SIZE,
  },
})

export default Row
