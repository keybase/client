// @flow
import React from 'react'
import Lottie from 'lottie-react-web'
import animationData from './animation-data.json'

export const TypingAnimation = () => (
  <Lottie
    options={{
      animationData,
      width: 48,
    }}
  />
)
