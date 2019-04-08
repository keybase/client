import * as React from 'react'
import { Position } from './relative-popup-hoc.types';
import { StylesCrossPlatform } from '../styles';

export type Props = {
  children: React.ElementType,
  className?: string | null,
  containerStyle?: StylesCrossPlatform,
  visible: boolean,
  attachTo?: () => React.ElementRef<any> | null | null,
  position?: Position
};

export default class extends React.Component<Props> {}
