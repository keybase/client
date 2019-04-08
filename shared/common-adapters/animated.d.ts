import * as React from 'react'
import * as Styles from '../styles'
import { _StylesCrossPlatform } from '../styles/css';

type Config = {
  clamp?: boolean,
  delay?: number,
  duration?: number,
  easing?: any,
  friction?: number,
  mass?: number,
  precision?: number,
  tension?: number,
  velocity?: number
};

export type Props = {
  children: (_StylesCrossPlatform: _StylesCrossPlatform) => React.ElementType,
  config?: Config | Function,
  delay?: number | Function,
  from: Styles.StylesCrossPlatform,
  immediate?: boolean | Function,
  onFrame?: Function,
  onRest?: Function,
  onStart?: Function,
  reset?: boolean,
  reverse?: boolean,
  to: Styles.StylesCrossPlatform
};

export default class Animated extends React.Component<Props> {}
