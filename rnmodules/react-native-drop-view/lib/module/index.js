function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
import DropView from './DropViewViewNativeComponent';
import { Platform, View } from 'react-native';
import * as React from 'react';
const isSupported = Platform.OS === 'ios';
const DropViewWrapper = p => {
  const {
    onDropped
  } = p;
  const onDroppedCB = React.useCallback(e => {
    try {
      const manifest = e.nativeEvent.manifest;
      const cleanedUp = manifest.reduce((arr, item) => {
        if (item.originalPath || item.content) {
          arr.push(item);
        }
        return arr;
      }, new Array());
      onDropped(cleanedUp);
    } catch (e) {
      console.log('drop view error', e);
    }
  }, [onDropped]);
  return /*#__PURE__*/React.createElement(DropView, _extends({}, p, {
    onDropped: onDroppedCB
  }));
};
export default isSupported ? DropViewWrapper : View;
//# sourceMappingURL=index.js.map