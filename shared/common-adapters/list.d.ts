import * as React from 'react'
import { StylesCrossPlatform } from '../styles';

export type Props<Item> = {
  bounces?: boolean,
  indexAsKey?: boolean,
  items: Array<Item>,
  style?: StylesCrossPlatform,
  fixedHeight?: number | null,
  renderItem: (index: number, item: Item) => React.ElementType,
  keyProperty?: string,
  selectedIndex?: number,
  itemSizeEstimator?: (
    index: number,
    cache: {
      [K in number]: number;
    }
  ) => number,
  keyboardShouldPersistTaps?: "never" | "always" | "handled",
  windowSize?: number,
  onEndReached?: () => void
};

export default class List<Item> extends React.Component<Props<Item>, void> {}
