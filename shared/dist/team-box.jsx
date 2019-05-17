"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const go_button_1 = require("./go-button");
const input_1 = require("./input");
const user_bubble_1 = require("./user-bubble");
const Kb = require("../common-adapters");
const Styles = require("../styles");
const formatNameForUserBubble = (username, service, prettyName) => {
    const technicalName = service === 'keybase' ? username : `${username} on ${service}`;
    return `${technicalName} ${prettyName ? `(${prettyName})` : ''}`;
};
class UserBubbleCollection extends React.PureComponent {
    render() {
        return this.props.teamSoFar.map(u => (<user_bubble_1.default key={u.userId} onRemove={() => this.props.onRemove(u.userId)} username={u.username} service={u.service} prettyName={formatNameForUserBubble(u.username, u.service, u.prettyName)}/>));
    }
}
const TeamInput = (props) => (<input_1.default hasMembers={!!props.teamSoFar.length} onChangeText={props.onChangeText} onEnterKeyDown={props.onEnterKeyDown} onDownArrowKeyDown={props.onDownArrowKeyDown} onUpArrowKeyDown={props.onUpArrowKeyDown} onBackspace={props.onBackspace} placeholder={props.teamSoFar.length ? 'Add another username or enter to chat' : 'Enter a username'} searchString={props.searchString}/>);
const TeamBox = (props) => (Styles.isMobile && (<Kb.Box2 direction="horizontal" style={styles.container}>
      <UserBubbleCollection teamSoFar={props.teamSoFar} onRemove={props.onRemove}/>
      <TeamInput {...props}/>
    </Kb.Box2>)) || (<Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Box2 direction="horizontal" style={styles.search}>
          <TeamInput {...props}/>
        </Kb.Box2>
        {!!props.teamSoFar.length && <go_button_1.default onClick={props.onFinishTeamBuilding}/>}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.bubbles}>
        <Kb.ScrollView horizontal={true}>
          <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.floatingBubbles}>
            <UserBubbleCollection teamSoFar={props.teamSoFar} onRemove={props.onRemove}/>
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    </Kb.Box2>);
const styles = Styles.styleSheetCreate({
    bubbles: Styles.platformStyles({
        isElectron: {
            overflow: 'hidden',
            paddingBottom: Styles.globalMargins.xsmall,
            paddingTop: Styles.globalMargins.xsmall,
        },
    }),
    container: Styles.platformStyles({
        common: {
            flexWrap: 'wrap',
        },
        isElectron: {
            backgroundColor: Styles.globalColors.blueGrey,
            paddingLeft: Styles.globalMargins.small,
            paddingRight: Styles.globalMargins.small,
            paddingTop: Styles.globalMargins.small,
        },
        isMobile: {
            borderBottomColor: Styles.globalColors.black_10,
            borderBottomWidth: 1,
            borderStyle: 'solid',
            flex: 1,
            minHeight: 48,
        },
    }),
    floatingBubbles: Styles.platformStyles({
        isElectron: {
            justifyContent: 'flex-end',
        },
    }),
    search: Styles.platformStyles({
        common: {
            flex: 1,
            flexWrap: 'wrap',
        },
        isElectron: Object.assign({}, Styles.globalStyles.rounded, { backgroundColor: Styles.globalColors.white, borderColor: Styles.globalColors.black_20, borderStyle: 'solid', borderWidth: 1, maxHeight: 170, minHeight: 40, overflowY: 'scroll' }),
        isMobile: {
            borderBottomColor: Styles.globalColors.black_10,
            borderBottomWidth: 1,
            borderStyle: 'solid',
            minHeight: 48,
        },
    }),
    searchIcon: {
        alignSelf: 'center',
        marginLeft: 10,
    },
});
exports.default = TeamBox;
//# sourceMappingURL=team-box.jsx.map