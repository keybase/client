"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const Kb = require("../common-adapters/index");
const Styles = require("../styles");
// @ts-ignore codemode issue
const desktop_style_1 = require("../common-adapters/desktop-style");
const shared_1 = require("./shared");
const bubbleSize = 32;
const removeSize = 16;
const KeybaseUserBubbleMobile = (props) => <Kb.Avatar size={bubbleSize} username={props.username}/>;
const GeneralServiceBubble = (props) => (<Kb.Icon style={styles.generalService} fontSize={bubbleSize} type={shared_1.serviceIdToIconFont(props.service)} colorOverride={shared_1.serviceIdToAccentColor(props.service)}/>);
const DesktopBubble = (props) => {
    const realCSS = `
    .hoverContainer { position: relative; }
    .hoverContainer .hoverComponent { visibility: hidden; position: absolute; top: 0; right: 0; }
    .hoverContainer:hover .hoverComponent { visibility: visible; }
    `;
    return (<Kb.Box2 direction="vertical" className="hoverContainer">
      <desktop_style_1.default style={realCSS}/>
      <Kb.Box2 className="user" direction="horizontal" style={styles.bubble}>
        <Kb.ConnectedNameWithIcon colorFollowing={true} hideFollowingOverlay={true} horizontal={false} icon={props.service !== 'keybase' ? shared_1.serviceIdToIconFont(props.service) : undefined} iconBoxStyle={props.service !== 'keybase' ? styles.iconBox : undefined} size="smaller" username={props.username}/>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" className="hoverComponent">
        <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove}/>
      </Kb.Box2>
    </Kb.Box2>);
};
const RemoveBubble = ({ onRemove, prettyName }) => (<Kb.WithTooltip text={prettyName} position={'top center'} containerStyle={styles.remove} className="remove">
    <Kb.ClickableBox onClick={() => onRemove()} style={styles.removeBubbleTextAlignCenter}>
      <Kb.Icon type={'iconfont-close'} color={Styles.isMobile ? Styles.globalColors.white : Styles.globalColors.black_50_on_white} fontSize={12} style={Kb.iconCastPlatformStyles(styles.removeIcon)}/>
    </Kb.ClickableBox>
  </Kb.WithTooltip>);
class _SwapOnClick extends React.PureComponent {
    constructor() {
        super(...arguments);
        this.state = { showClickedLayer: false };
        this._onClick = () => {
            if (!this.state.showClickedLayer) {
                this.setState({ showClickedLayer: true });
                if (this.props.clickedLayerTimeout) {
                    this.props.setTimeout(() => this.setState({ showClickedLayer: false }), this.props.clickedLayerTimeout);
                }
            }
        };
    }
    render() {
        const ClickedLayerComponent = this.props.clickedLayerComponent;
        return (<Kb.ClickableBox onClick={this._onClick} style={this.props.containerStyle}>
        {this.state.showClickedLayer ? <ClickedLayerComponent /> : this.props.children}
      </Kb.ClickableBox>);
    }
}
const SwapOnClick = Kb.HOCTimers(_SwapOnClick);
function SwapOnClickHoc(
// @ts-ignore codemode issue
Component, 
// @ts-ignore codemode issue
OtherComponent
// @ts-ignore codemode issue
) {
    return ({ containerStyle }) => (<SwapOnClick containerStyle={containerStyle} clickedLayerTimeout={5e3} clickedLayerComponent={OtherComponent}>
      <Component />
    </SwapOnClick>);
}
const UserBubble = (props) => {
    const NormalComponent = () => props.service === 'keybase' ? <KeybaseUserBubbleMobile {...props}/> : <GeneralServiceBubble {...props}/>;
    const AlternateComponent = () => <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove}/>;
    const Component = SwapOnClickHoc(NormalComponent, AlternateComponent);
    return Styles.isMobile ? <Component containerStyle={styles.container}/> : <DesktopBubble {...props}/>;
};
const styles = Styles.styleSheetCreate({
    bubble: Styles.platformStyles({
        common: {},
        isElectron: {
            flexShrink: 1,
            marginLeft: Styles.globalMargins.tiny,
            marginRight: Styles.globalMargins.tiny,
        },
        isMobile: {
            height: bubbleSize,
            width: bubbleSize,
        },
    }),
    container: Styles.platformStyles({
        common: {
            marginBottom: Styles.globalMargins.xtiny,
            marginLeft: Styles.globalMargins.tiny,
            marginTop: Styles.globalMargins.xtiny,
        },
    }),
    generalService: Styles.platformStyles({
        isElectron: {
            lineHeight: '35px',
        },
    }),
    // TODO: the service icons are too high without this - are they right?
    iconBox: Styles.platformStyles({
        isElectron: {
            marginBottom: -3,
            marginTop: 3,
        },
    }),
    remove: Styles.platformStyles({
        common: {
            borderRadius: 100,
            height: removeSize,
            width: removeSize,
        },
        isElectron: {
            backgroundColor: Styles.globalColors.white,
            cursor: 'pointer',
            marginRight: Styles.globalMargins.tiny,
        },
        isMobile: {
            backgroundColor: Styles.globalColors.red,
            height: bubbleSize,
            width: bubbleSize,
        },
    }),
    removeBubbleTextAlignCenter: Styles.platformStyles({
        isElectron: {
            margin: 'auto',
            textAlign: 'center',
        },
        isMobile: {
            alignItems: 'center',
            flex: 1,
        },
    }),
    removeIcon: Styles.platformStyles({
        isElectron: {
            lineHeight: '16px',
        },
        isMobile: {
            lineHeight: 34,
        },
    }),
});
exports.default = UserBubble;
//# sourceMappingURL=user-bubble.jsx.map