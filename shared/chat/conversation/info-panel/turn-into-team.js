// @flow
import * as React from 'react'
import {ButtonBar, Button, Text} from '../../../common-adapters'
import {globalMargins} from '../../../styles'

const TurnIntoTeam = ({onClick}: {onClick: () => void}) => {
  return [
    <ButtonBar key="turnIntoTeamButtonBar" small={true}>
      <Button type="Primary" small={true} label="Turn into team" onClick={onClick} />
    </ButtonBar>,
    <Text
      key="turnIntoTeamText"
      style={{
        alignSelf: 'center',
        marginLeft: globalMargins.small,
        marginRight: globalMargins.small,
        textAlign: 'center',
      }}
      type="BodySmall"
    >
      You'll be able to add and delete members as you wish.
    </Text>,
  ]
}

export {TurnIntoTeam}
