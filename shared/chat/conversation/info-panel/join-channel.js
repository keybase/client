// @flow
import * as React from 'react'
import {ButtonBar, Button, Text} from '../../../common-adapters'
import {globalMargins} from '../../../styles'

const JoinChannel = (props: {teamname: string, onClick: () => void}) => {
  return [
    <ButtonBar key="joinChannelButtonBar" small={true}>
      <Button type="Primary" small={true} label="Join channel" onClick={props.onClick} />
    </ButtonBar>,
    <Text
      key="joinChannelText"
      style={{
        alignSelf: 'center',
        marginLeft: globalMargins.small,
        marginRight: globalMargins.small,
        textAlign: 'center',
      }}
      type="BodySmall"
    >
      Anyone in {props.teamname} can join.
    </Text>,
  ]
}

export {JoinChannel}
