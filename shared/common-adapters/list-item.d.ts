import * as React from 'react'

// splits the rendering into 3 parts like the style guide shows.
// Part 1 Icon
// Part 2 Text / Body
// Part 3 Action (could be text or button)

export type Props = {
  type: 'Small' | 'Large'
  icon: React.ReactNode
  body: React.ReactNode
  action: React.ReactNode
  extraRightMarginAction?: boolean // Spacing is different if the action is just text (for example),
  onClick?: () => void
  onPress?: void
  containerStyle?: Object
  bodyContainerStyle?: Object
  swipeToAction?: boolean // Do you have to swipe the list item to reveal an action?
}

export default class ListItem extends React.Component<Props> {}
