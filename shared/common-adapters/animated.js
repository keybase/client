// @flow
import * as React from 'react'
import {Spring} from 'react-spring'
import type {Props} from './animated'

const Animated = (props: Props) => {
  const {children, ...springProps} = props
  return <Spring {...springProps}>{children}</Spring>
}

export default Animated
