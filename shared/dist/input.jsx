"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const lodash_es_1 = require("lodash-es");
const Kb = require("../common-adapters/index");
const Styles = require("../styles");
const handleKeyDown = (preventDefault, ctrlKey, key, props) => {
    switch (key) {
        case 'p':
            if (ctrlKey) {
                preventDefault();
                props.onUpArrowKeyDown();
            }
            break;
        case 'n':
            if (ctrlKey) {
                preventDefault();
                props.onDownArrowKeyDown();
            }
            break;
        case 'Tab':
        case ',':
            preventDefault();
            props.onEnterKeyDown();
            break;
        case 'ArrowDown':
            preventDefault();
            props.onDownArrowKeyDown();
            break;
        case 'ArrowUp':
            preventDefault();
            props.onUpArrowKeyDown();
            break;
        case 'Backspace':
            props.onBackspace();
            break;
    }
};
const Input = (props) => (<Kb.Box2 direction="horizontal" style={styles.container}>
    <Kb.PlainInput autoFocus={true} globalCaptureKeypress={true} style={styles.input} placeholder={props.placeholder} onChangeText={props.onChangeText} value={props.searchString} maxLength={50} onEnterKeyDown={props.onEnterKeyDown} onKeyDown={e => {
    handleKeyDown(() => e.preventDefault(), e.ctrlKey, e.key, props);
}} onKeyPress={e => {
    handleKeyDown(lodash_es_1.noop, false, e.nativeEvent.key, props);
}}/>
  </Kb.Box2>);
const styles = Styles.styleSheetCreate({
    container: Styles.platformStyles({
        common: {
            flex: 1,
            marginLeft: Styles.globalMargins.xsmall,
        },
        isElectron: {
            minHeight: 32,
        },
        isMobile: {
            height: '100%',
            minWidth: 50,
        },
    }),
    input: Styles.platformStyles({
        common: {
            flex: 1,
        },
    }),
});
exports.default = Input;
//# sourceMappingURL=input.jsx.map