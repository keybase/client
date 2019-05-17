"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const Kb = require("../common-adapters/index");
const Styles = require("../styles");
const Go = () => (<Kb.Text type="BodyBig" style={styles.go}>
    Go!
  </Kb.Text>);
const GoIcon = () => (<Kb.Icon type="iconfont-return" fontSize={16} color={Styles.globalColors.white} style={Kb.iconCastPlatformStyles(styles.goIcon)}/>);
const GoWithIconHover = Kb.HoverHoc(Go, GoIcon);
const GoButton = (props) => (<Kb.ClickableBox onClick={() => props.onClick()} style={styles.container}>
    <GoWithIconHover />
  </Kb.ClickableBox>);
const styles = Styles.styleSheetCreate({
    container: Styles.platformStyles({
        common: Object.assign({ backgroundColor: Styles.globalColors.blue }, Styles.globalStyles.rounded, { marginLeft: Styles.globalMargins.tiny }),
        isElectron: { height: 40, width: 40 },
    }),
    go: Styles.platformStyles({
        common: { color: Styles.globalColors.white },
        isElectron: { lineHeight: 40 },
    }),
    goIcon: Styles.platformStyles({
        isElectron: {
            lineHeight: 40,
        },
    }),
});
exports.default = GoButton;
//# sourceMappingURL=go-button.jsx.map