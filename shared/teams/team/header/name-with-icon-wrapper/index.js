// @flow
import * as React from 'react'

export type Props = {
  canEditDescription: boolean,
  onEditIcon: any => void,
  teamname: string,
  metaOne: React.Node,
  metaTwo: string,
}

export default class Render extends React.Component<Props> {}
