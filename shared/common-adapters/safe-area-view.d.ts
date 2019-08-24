import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  children?: React.ReactNode
  style?: StylesCrossPlatform
}

export default class SafeAreaView extends React.Component<Props> {}
export class SafeAreaViewTop extends React.Component<Props> {}
