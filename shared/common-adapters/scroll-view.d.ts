import * as React from 'react'
import { StylesCrossPlatform } from '../styles';

export type Props = {
  contentContainerStyle?: StylesCrossPlatform,
  style?: StylesCrossPlatform,
  onScroll?: Function | null,
  className?: string | null,
  ref?: React.Ref<any> | null,
  hideVerticalScroll?: boolean,
  bounces?: boolean,
  centerContent?: boolean,
  minimumZoomScale?: number,
  maximumZoomScale?: number,
  onLayout?: Function,
  scrollEventThrottle?: number,
  scrollsToTop?: boolean,
  indicatorStyle?: string,
  alwaysBounceVertical?: boolean,
  alwaysBounceHorizontal?: boolean,
  showsVerticalScrollIndicator?: boolean,
  showsHorizontalScrollIndicator?: boolean,
  horizontal?: boolean,
  refreshControl?: React.Element<any>
};

export default class ScrollView extends React.Component<Props> {
  scrollTo: (
    arg0: {
      x: number,
      y: number,
      animated?: boolean
    }
  ) => void | null;
}
