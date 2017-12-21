// @flow
import React from 'react'
import PeopleItem from '../item'
import {Box, Button, Text} from '../../common-adapters'
import {type IconType} from '../../common-adapters/icon.constants'
import {globalStyles, globalMargins} from '../../styles'

export type Props = {
  badged: boolean,
  icon: IconType,
  instructions: string,
  confirmLabel: string,
  dismissable?: boolean,
  onConfirm: () => void,
  onDismiss: () => void,
}

export default (props: Props) => (
  <PeopleItem badged={props.badged} icon={props.icon}>
    <Text type="Body" style={{marginTop: 2, marginBottom: globalMargins.xtiny, paddingRight: 40}}>
      {props.instructions}
    </Text>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        justifyContent: 'flex-start',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <Button
        small={true}
        type="Primary"
        label={props.confirmLabel}
        onClick={props.onConfirm}
        style={{marginRight: globalMargins.small}}
      />
      {props.dismissable && <Text type="BodyPrimaryLink" onClick={props.onDismiss}>Later</Text>}
    </Box>
  </PeopleItem>
)
