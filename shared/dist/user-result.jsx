"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const Kb = require("../common-adapters");
const Styles = require("../styles");
const shared_1 = require("../search/shared");
const shared_2 = require("./shared");
const realCSS = (inTeam) => `
    .hoverRow${inTeam ? 'inTeam' : ''}:hover { background-color: ${Styles.globalColors.blueLighter2};}
    .hoverRow${inTeam ? 'inTeam' : ''}:hover .actionButton * { color: ${Styles.globalColors.white} !important;}
    .hoverRow${inTeam ? 'inTeam' : ''}:hover .actionButton { background-color: ${inTeam ? Styles.globalColors.red : Styles.globalColors.blue} !important;}
`;
class Row extends React.Component {
    constructor() {
        super(...arguments);
        this.state = { hovering: false };
        this.render = () => {
            const keybaseResult = this.props.resultForService === 'keybase';
            const keybaseUsername = this.props.services['keybase'] || null;
            const serviceUsername = this.props.services[this.props.resultForService];
            return (<Kb.ClickableBox onClick={this.props.inTeam ? this.props.onRemove : this.props.onAdd}>
        <Kb.Box2 onMouseOver={() => {
                this.setState({ hovering: true });
            }} onMouseLeave={() => {
                this.setState({ hovering: false });
            }} className={Styles.classNames({
                hoverRow: !this.props.inTeam,
                hoverRowinTeam: this.props.inTeam,
            })} direction="horizontal" fullWidth={true} centerChildren={true} style={Styles.collapseStyles([
                styles.rowContainer,
                this.props.highlight ? styles.highlighted : null,
            ])}>
          <Kb.DesktopStyle style={realCSS(this.props.inTeam)}/>
          <Avatar resultForService={this.props.resultForService} keybaseUsername={keybaseUsername}/>
          <Username keybaseResult={keybaseResult} username={serviceUsername} prettyName={this.props.prettyName} followingState={this.props.followingState}/>
          <Services keybaseResult={keybaseResult} services={this.props.services} keybaseUsername={keybaseUsername} followingState={this.props.followingState}/>
          <ActionButton inTeam={this.props.inTeam} onAdd={this.props.onAdd} onRemove={this.props.onRemove} highlight={this.props.highlight} hover={this.state.hovering}/>
        </Kb.Box2>
      </Kb.ClickableBox>);
        };
    }
}
const AvatarSize = Styles.isMobile ? 48 : 32;
const Avatar = ({ resultForService, keybaseUsername, }) => {
    if (keybaseUsername) {
        return <Kb.Avatar size={AvatarSize} username={keybaseUsername}/>;
    }
    return (<Kb.Icon fontSize={AvatarSize} type={shared_2.serviceIdToIconFont(resultForService)} colorOverride={shared_2.serviceIdToAccentColor(resultForService)}/>);
};
const Username = (props) => (<Kb.Box2 direction="vertical" style={styles.username}>
    <Kb.Text type="BodySemibold" style={shared_1.followingStateToStyle(props.keybaseResult ? props.followingState : 'NoState')}>
      {props.username}
    </Kb.Text>
    {!!props.prettyName && <Kb.Text type="BodySmall">{props.prettyName}</Kb.Text>}
  </Kb.Box2>);
const Services = ({ services, keybaseResult, keybaseUsername, followingState, }) => {
    if (keybaseResult) {
        return (<Kb.Box2 direction="horizontal" style={styles.services}>
        {Object.keys(services)
            .filter(s => s !== 'keybase')
            .map(service => (<Kb.WithTooltip key={service} text={services[service]} position="top center">
              <Kb.Icon type={shared_2.serviceIdToIconFont(service)} style={Kb.iconCastPlatformStyles(styles.serviceIcon)}/>
            </Kb.WithTooltip>))}
      </Kb.Box2>);
    }
    else if (keybaseUsername) {
        return (<Kb.Box2 direction="horizontal" style={styles.services}>
        <Kb.Icon type={'icon-keybase-logo-16'} style={Kb.iconCastPlatformStyles(styles.keybaseServiceIcon)}/>
        <Kb.Text type="BodySemibold" style={shared_1.followingStateToStyle(followingState)}>
          {keybaseUsername}
        </Kb.Text>
      </Kb.Box2>);
    }
    return null;
};
const ActionButton = (props) => {
    let Icon = props.inTeam ? AlreadyAddedIconButton : AddButton;
    if (props.highlight) {
        Icon = props.inTeam ? RemoveButton : AddButtonHover;
    }
    else if (props.hover) {
        Icon = props.inTeam ? RemoveButton : AddButton;
    }
    return (<Kb.ClickableBox onClick={props.inTeam ? props.onRemove : props.onAdd}>
      <Kb.Box2 className="actionButton" direction="vertical" centerChildren={true} style={Styles.collapseStyles([
        styles.actionButton,
        props.inTeam && { backgroundColor: null },
        props.highlight && {
            backgroundColor: props.inTeam ? Styles.globalColors.red : Styles.globalColors.blue,
        },
    ])}>
        <Icon />
      </Kb.Box2>
    </Kb.ClickableBox>);
};
const AddButton = () => <Kb.Icon type="iconfont-new" fontSize={16} color={Styles.globalColors.black}/>;
const AddButtonHover = () => (<Kb.Box2 direction="vertical" centerChildren={true} style={styles.addToTeamIcon}>
    <Kb.Icon type="iconfont-return" fontSize={16} color={Styles.globalColors.white}/>
  </Kb.Box2>);
const RemoveButton = () => (<Kb.Box2 direction="vertical" centerChildren={true} style={styles.removeButton}>
    <Kb.Icon type="iconfont-close" fontSize={16} color={Styles.globalColors.white}/>
  </Kb.Box2>);
const AlreadyAddedIconButton = () => (<Kb.Icon type="iconfont-check" fontSize={16} color={Styles.globalColors.blue}/>);
const ActionButtonSize = Styles.isMobile ? 40 : 32;
const styles = Styles.styleSheetCreate({
    actionButton: Styles.platformStyles({
        common: Object.assign({}, Styles.globalStyles.rounded, { backgroundColor: Styles.globalColors.grey, height: ActionButtonSize, marginLeft: Styles.globalMargins.tiny, width: ActionButtonSize }),
    }),
    actionButtonHighlight: {
        backgroundColor: Styles.globalColors.blue,
    },
    actionButtonHoverContainer: Styles.platformStyles({
        common: Object.assign({}, Styles.globalStyles.rounded, { height: ActionButtonSize, justifyContent: 'center', width: ActionButtonSize }),
    }),
    addToTeamIcon: Object.assign({}, Styles.globalStyles.rounded, { height: ActionButtonSize, width: ActionButtonSize }),
    highlighted: Styles.platformStyles({
        isElectron: {
            backgroundColor: Styles.globalColors.blueLighter2,
            borderRadius: Styles.borderRadius,
        },
    }),
    keybaseServiceIcon: Styles.platformStyles({
        common: {
            marginRight: Styles.globalMargins.xtiny,
        },
    }),
    removeButton: Object.assign({}, Styles.globalStyles.rounded, { height: ActionButtonSize, width: ActionButtonSize }),
    removeButtonHighlight: {
        backgroundColor: Styles.globalColors.red,
    },
    rowContainer: Styles.platformStyles({
        common: {
            paddingBottom: Styles.globalMargins.tiny,
            paddingTop: Styles.globalMargins.tiny,
        },
        isElectron: {
            height: 50,
            paddingLeft: Styles.globalMargins.tiny,
            paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {
            paddingLeft: Styles.globalMargins.xsmall,
            paddingRight: Styles.globalMargins.xsmall,
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
        marginLeft: Styles.globalMargins.small,
    },
});
exports.default = Row;
//# sourceMappingURL=user-result.jsx.map