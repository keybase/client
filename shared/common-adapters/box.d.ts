import * as React from 'react'
import { StylesCrossPlatform, globalMargins } from '../styles';
export type Props = any;

export type Box2Props = {
  alignItems?: "center" | "flex-start" | "flex-end" | "stretch",
  alignSelf?: null | "center" | "flex-start" | "flex-end",
  centerChildren?: boolean,
  className?: string | null,
  direction: "horizontal" | "vertical" | "horizontalReverse" | "verticalReverse",
  fullHeight?: boolean,
  fullWidth?: boolean,
  noShrink?: boolean,
  onLayout?: (
    evt: {
      nativeEvent: {
        layout: {
          x: number,
          y: number,
          width: number,
          height: number
        }
      }
    }
  ) => void,
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void,
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void,
  style?: StylesCrossPlatform,
  gap?: keyof typeof globalMargins,
  gapStart?: boolean,
  gapEnd?: boolean
};

export declare class Box extends React.Component<Props> {}
export declare class Box2 extends React.Component<Box2Props> {}
export default Box
