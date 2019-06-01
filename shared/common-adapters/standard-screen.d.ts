import * as React from 'react'
import {StylesCrossPlatform} from '../styles/css'

export type NotificationType = 'error' | 'success'

export type Props = {
  children?: any | null
  borderless?: boolean
  notification?: {
    message: string | React.ReactNode
    type: NotificationType
  } | null
  style?: StylesCrossPlatform
  theme?: 'light' | 'dark' // defaults to light,
  scrollEnabled?: boolean
  styleBanner?: Object | null
  onClose?: Function
  onBack?: Function
}

export default class StandardScreen extends React.Component<Props> {}
