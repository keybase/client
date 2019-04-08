import * as React from 'react'

// splits the rendering into 3 parts like the style guide shows.
// Part 1 Icon
// Part 2 Text / Body
// Part 3 Action (could be text or button)

export type Props = {
  type: "Small" | "Large",
  icon: React.ElementType,
  body: React.ElementType,
  action: React.ElementType,
  extraRightMarginAction?: boolean,
  onClick?: () => void,
  onPress?: void,
  containerStyle?: Object,
  bodyContainerStyle?: Object,
  swipeToAction?: boolean
};

export default class ListItem extends React.Component<Props> {}
