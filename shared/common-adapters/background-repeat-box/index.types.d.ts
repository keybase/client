import * as React from 'react'
import { StylesCrossPlatform } from '../../styles/css';

// Cross platform Box with a repeating background image

export type Props = {
  children: React.ElementType,
  imageHeight: number,
  imageName: string,
  imageWidth: number,
  skipBackground?: boolean,
  style?: StylesCrossPlatform
};
