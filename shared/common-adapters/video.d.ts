import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  hideControls?: boolean | null,
  style?: Styles.StylesCrossPlatform | null,
  url: string
};

export type State = {
  containerHeight: number,
  containerWidth: number,
  loadedVideoSize: boolean,
  videoHeight: number,
  videoWidth: number
};

declare var toExport: React.ComponentType<Props>;
export default toExport
