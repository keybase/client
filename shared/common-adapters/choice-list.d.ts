import * as React from 'react'
import { IconType } from './icon';

export type Option = {
  title: string,
  description: string,
  icon: IconType | React.ElementType,
  onClick: () => void,
  onPress?: void
};

export type Props = {
  options: Array<Option>
};

export default class ChoiceList extends React.Component<Props> {}
