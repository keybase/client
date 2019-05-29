import * as React from 'react'
import * as Styles from '../../../../../styles'
import {Props} from '.'

const patternImage = Styles.backgroundURL('payment-pattern-80.png')

const bgScroll = Styles.styledKeyframes({
  from: {transform: 'translateY(0)'},
  to: {transform: 'translateY(-80px)'},
})

// @ts-ignore
const BackgroundBox = Styles.styled.div({
  animation: `${bgScroll} 2s linear infinite`,
  backgroundImage: patternImage,
  backgroundRepeat: 'repeat',
  backgroundSize: '80px 80px',
  bottom: '-80px',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
  willChange: 'transform',
  zIndex: -1,
})

const PendingBackground = (props: Props) => (
  <>
    <BackgroundBox />
    {props.children}
  </>
)

export default PendingBackground
