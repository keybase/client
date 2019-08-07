import * as React from 'react'
import {StylesCrossPlatform} from '../../styles/css'

// Cross platform Box with a repeating background image

export type Props = {
  children: React.ReactNode
  imageHeight: number
  imageName: string | number // on desktop this is the filename under 'shared/images/icons'. on native this is the image loaded via require(..),
  imageWidth: number
  skipBackground?: boolean // don't add any styles or background image,
  style?: StylesCrossPlatform
}
