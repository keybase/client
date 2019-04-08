import * as React from 'react'
import { StylesCrossPlatform } from '../styles/css';

export type NotificationType = "error" | "success";

export type Props = {
  borderless?: boolean,
  notification?: {
    message: string | React.ElementType,
    type: NotificationType
  } | null,
  style?: StylesCrossPlatform,
  theme?: "light" | "dark",
  scrollEnabled?: boolean,
  styleBanner?: Object | null
};

export default class StandardScreen extends React.Component<Props> {}
