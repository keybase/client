import * as React from 'react'
import { StylesCrossPlatform } from '../styles';

export type Props = {
  style?: StylesCrossPlatform
};

export default class SafeAreaView extends React.Component<Props> {}
export class SafeAreaViewTop extends React.Component<Props> {}
