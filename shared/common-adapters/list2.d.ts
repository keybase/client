import * as React from 'react'
import { StylesCrossPlatformWithSomeDisallowed } from '../styles';

// List2 differs from list in that on desktop it uses react-window.
// Don't use List2 if you need a list with dynamic item sizes

export type VariableItemHeight<Item> = {
  getItemLayout: (index: number, item: Item) => {
    height: number,
    offset: number
  },
  type: "variable"
};

export type FixedHeight = {
  height: number,
  type: "fixed"
};

type DisallowedStyles = {
  flex?: never,
  flexDirection?: never
};

export type Props<Item> = {
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>,
  indexAsKey?: boolean,
  keyProperty?: string,
  items: Array<Item>,
  renderItem: (index: number, item: Item) => React.ElementType,
  itemHeight: VariableItemHeight<Item> | FixedHeight,
  estimatedItemHeight?: number,
  selectedIndex?: number,
  bounces?: boolean,
  keyboardShouldPersistTaps?: "never" | "always" | "handled",
  windowSize?: number,
  onEndReached?: () => void
};

export default class List2<Item> extends React.Component<Props<Item>, void> {}
