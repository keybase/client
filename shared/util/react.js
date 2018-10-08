// @flow
import * as React from 'react'

// React related utilities

// Flow is missing a type for React.ForwardRef. See https://github.com/facebook/flow/issues/6103
// Taken from https://github.com/facebook/flow/pull/6510
export function forwardRef<Props, ElementType: React$ElementType>(
  render: (props: Props, ref: React$Ref<ElementType>) => React$Node
): React$ComponentType<Props> {
  // $FlowIssue
  return React.forwardRef(render)
}
