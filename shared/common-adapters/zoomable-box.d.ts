import * as React from 'react'

export type Props = {
  maxZoom?: number,
  minZoom?: number,
  onZoom?: ((
    arg0: {
      height: number,
      width: number,
      x: number,
      y: number
    }
  ) => void) | null,
  style?: any,
  bounces?: boolean,
  children?: React.ReactNode,
  key?: React.Key,
  showsVerticalScrollIndicator?: boolean,
  showsHorizontalScrollIndicator?: boolean,
  contentContainerStyle?: any
};

export class ZoomableBox extends React.Component<Props> {}
