// @flow
import * as React from 'react'
import {Text} from '../../../../common-adapters'

type Props = {|
  channelname: string,
  isBigTeam: boolean,
  teamname: string,
|}

export default (props: Props) => (
  <Text type="BodySmall">left {props.isBigTeam ? `#${props.channelname}` : props.teamname}.</Text>
)
