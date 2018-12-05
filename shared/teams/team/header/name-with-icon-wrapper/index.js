// @flow
import * as React from 'react'
import type {Response} from 'react-native-image-picker'

export type Props = {
  canEditDescription: boolean,
  onEditIcon: (image?: Response) => void,
  onEditIconError: (error: string) => void,
  teamname: string,
  metaOne: React.Node,
  metaTwo: string,
}

export default class Render extends React.Component<Props> {}
