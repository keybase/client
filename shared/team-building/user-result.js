"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var React = require("react");
var Kb = require("../common-adapters");
var Styles = require("../styles");
var shared_1 = require("../search/shared");
var shared_2 = require("./shared");
var realCSS = function (inTeam) { return "\n    .hoverRow" + (inTeam ? 'inTeam' : '') + ":hover { background-color: " + Styles.globalColors.blue4 + ";}\n    .hoverRow" + (inTeam ? 'inTeam' : '') + ":hover .actionButton * { color: " + Styles.globalColors.white + " !important;}\n    .hoverRow" + (inTeam ? 'inTeam' : '') + ":hover .actionButton { background-color: " + (inTeam ? Styles.globalColors.red : Styles.globalColors.blue) + " !important;}\n"; };
var Row = /** @class */ (function (_super) {
    __extends(Row, _super);
    function Row() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = { hovering: false };
        _this.render = function () {
            var keybaseResult = _this.props.resultForService === 'keybase';
            var keybaseUsername = _this.props.services['keybase'] || null;
            var serviceUsername = _this.props.services[_this.props.resultForService];
            return (<Kb.ClickableBox onClick={_this.props.inTeam ? _this.props.onRemove : _this.props.onAdd}>
        <Kb.Box2 onMouseOver={function () {
                _this.setState({ hovering: true });
            }} onMouseLeave={function () {
                _this.setState({ hovering: false });
            }} className={Styles.classNames({
                hoverRow: !_this.props.inTeam,
                hoverRowinTeam: _this.props.inTeam
            })} direction="horizontal" fullWidth={true} centerChildren={true} style={Styles.collapseStyles([
                styles.rowContainer,
                _this.props.highlight ? styles.highlighted : null,
            ])}>
          <Kb.DesktopStyle style={realCSS(_this.props.inTeam)}/>
          <Avatar resultForService={_this.props.resultForService} keybaseUsername={keybaseUsername}/>
          <Username keybaseResult={keybaseResult} username={serviceUsername} prettyName={_this.props.prettyName} followingState={_this.props.followingState}/>
          <Services keybaseResult={keybaseResult} services={_this.props.services} keybaseUsername={keybaseUsername} followingState={_this.props.followingState}/>
          <ActionButton inTeam={_this.props.inTeam} onAdd={_this.props.onAdd} onRemove={_this.props.onRemove} highlight={_this.props.highlight} hover={_this.state.hovering}/>
        </Kb.Box2>
      </Kb.ClickableBox>);
        };
        return _this;
    }
    return Row;
}(React.Component));
var AvatarSize = Styles.isMobile ? 48 : 32;
var Avatar = function (_a) {
    var resultForService = _a.resultForService, keybaseUsername = _a.keybaseUsername;
    if (keybaseUsername) {
        return <Kb.Avatar size={AvatarSize} username={keybaseUsername}/>;
    }
    return (<Kb.Icon fontSize={AvatarSize} type={shared_2.serviceIdToIconFont(resultForService)} colorOverride={shared_2.serviceIdToAccentColor(resultForService)}/>);
};
var Username = function (props) { return (<Kb.Box2 direction="vertical" style={styles.username}>
    <Kb.Text type="BodySemibold" style={shared_1.followingStateToStyle(props.keybaseResult ? props.followingState : 'NoState')}>
      {props.username}
    </Kb.Text>
    {!!props.prettyName && <Kb.Text type="BodySmall">{props.prettyName}</Kb.Text>}
  </Kb.Box2>); };
var Services = function (_a) {
    var services = _a.services, keybaseResult = _a.keybaseResult, keybaseUsername = _a.keybaseUsername, followingState = _a.followingState;
    if (keybaseResult) {
        return (<Kb.Box2 direction="horizontal" style={styles.services}>
        {Object.keys(services)
            .filter(function (s) { return s !== 'keybase'; })
            .map(function (service) { return (<Kb.WithTooltip key={service} text={services[service]} position="top center">
              <Kb.Icon type={shared_2.serviceIdToIconFont(service)} style={Kb.iconCastPlatformStyles(styles.serviceIcon)}/>
            </Kb.WithTooltip>); })}
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
var ActionButton = function (props) {
    var Icon = props.inTeam ? AlreadyAddedIconButton : AddButton;
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
            backgroundColor: props.inTeam ? Styles.globalColors.red : Styles.globalColors.blue
        },
    ])}>
        <Icon />
      </Kb.Box2>
    </Kb.ClickableBox>);
};
var AddButton = function () { return <Kb.Icon type="iconfont-new" fontSize={16} color={Styles.globalColors.black}/>; };
var AddButtonHover = function () { return (<Kb.Box2 direction="vertical" centerChildren={true} style={styles.addToTeamIcon}>
    <Kb.Icon type="iconfont-return" fontSize={16} color={Styles.globalColors.white}/>
  </Kb.Box2>); };
var RemoveButton = function () { return (<Kb.Box2 direction="vertical" centerChildren={true} style={styles.removeButton}>
    <Kb.Icon type="iconfont-close" fontSize={16} color={Styles.globalColors.white}/>
  </Kb.Box2>); };
var AlreadyAddedIconButton = function () { return (<Kb.Icon type="iconfont-check" fontSize={16} color={Styles.globalColors.blue}/>); };
var ActionButtonSize = Styles.isMobile ? 40 : 32;
var styles = Styles.styleSheetCreate({
    actionButton: Styles.platformStyles({
        common: __assign({}, Styles.globalStyles.rounded, { backgroundColor: Styles.globalColors.lightGrey2, height: ActionButtonSize, marginLeft: Styles.globalMargins.tiny, width: ActionButtonSize })
    }),
    actionButtonHighlight: {
        backgroundColor: Styles.globalColors.blue
    },
    actionButtonHoverContainer: Styles.platformStyles({
        common: __assign({}, Styles.globalStyles.rounded, { height: ActionButtonSize, justifyContent: 'center', width: ActionButtonSize })
    }),
    addToTeamIcon: __assign({}, Styles.globalStyles.rounded, { height: ActionButtonSize, width: ActionButtonSize }),
    highlighted: Styles.platformStyles({
        isElectron: {
            backgroundColor: Styles.globalColors.blue4,
            borderRadius: Styles.borderRadius
        }
    }),
    keybaseServiceIcon: Styles.platformStyles({
        common: {
            marginRight: Styles.globalMargins.xtiny
        }
    }),
    removeButton: __assign({}, Styles.globalStyles.rounded, { height: ActionButtonSize, width: ActionButtonSize }),
    removeButtonHighlight: {
        backgroundColor: Styles.globalColors.red
    },
    rowContainer: Styles.platformStyles({
        common: {
            paddingBottom: Styles.globalMargins.tiny,
            paddingTop: Styles.globalMargins.tiny
        },
        isElectron: {
            height: 50,
            paddingLeft: Styles.globalMargins.tiny,
            paddingRight: Styles.globalMargins.tiny
        },
        isMobile: {
            paddingLeft: Styles.globalMargins.xsmall,
            paddingRight: Styles.globalMargins.xsmall
        }
    }),
    serviceIcon: Styles.platformStyles({
        common: {
            marginLeft: Styles.globalMargins.tiny
        },
        isElectron: {
            height: 18,
            width: 18
        }
    }),
    services: {
        justifyContent: 'flex-end'
    },
    username: {
        flex: 1,
        marginLeft: Styles.globalMargins.small
    }
});
exports["default"] = Row;
