"use strict";

import DropView from './DropViewViewNativeComponent';
import { Platform, View } from 'react-native';
import * as React from 'react';
import { jsx as _jsx } from "react/jsx-runtime";
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
  return /*#__PURE__*/_jsx(DropView, {
    ...p,
    onDropped: onDroppedCB
  });
};
export default isSupported ? DropViewWrapper : View;
//# sourceMappingURL=index.js.map