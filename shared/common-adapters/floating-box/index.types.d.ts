import * as React from 'react'
import { StylesCrossPlatform } from '../../styles/css';
import { Position } from '../relative-popup-hoc.types';

// GatewayDests:
// popup-root: At the root of the app. Sibling to root route renderer.
// keyboard-avoiding-root: Within route renderer inside KeyboardAvoidingView. Sibling to route stack.

export type Props = {
  dest?: "popup-root" | "keyboard-avoiding-root",
  onHidden?: () => void,
  attachTo?: () => React.ElementRef<any> | null | null,
  propagateOutsideClicks?: boolean,
  containerStyle?: StylesCrossPlatform,
  matchDimension?: boolean,
  position?: Position,
  positionFallbacks?: Position[]
};
