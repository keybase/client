import * as React from 'react'
import {Spring} from 'react-spring'
import {Props} from './animated.d'

const Animated = (props: Props) => {
  const {children, ...springProps} = props
  return <Spring {...springProps}>{children}</Spring>
}

export default Animated
