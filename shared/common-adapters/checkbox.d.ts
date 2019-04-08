
import React, { Component, Node } from 'react';
import { TextType } from './text';
import { StylesCrossPlatform } from '../styles';

export type Props = {
  key?: string,
  label?: string,
  labelComponent?: Node,
  onCheck: (newCheckedValue: boolean) => void | null,
  checked: boolean,
  style?: StylesCrossPlatform,
  disabled?: boolean
};

export declare class Checkbox extends Component<Props> {}
