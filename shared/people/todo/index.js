// @flow
import React from 'react'
import PeopleItem from '../item'
import {Box, Button, Icon, Text, type IconType} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

export type Props = {
  badged: boolean,
  icon: IconType,
  instructions: string,
  confirmLabel: string,
  dismissable: boolean,
  onConfirm: () => void,
  onDismiss: () => void,
}

export const Task = (props: Props) => (
  <PeopleItem badged={props.badged} icon={<Icon type={props.icon} />}>
    <Text type="Body" style={{marginTop: 2, marginBottom: globalMargins.xtiny}}>
      {props.instructions}
    </Text>
    <Box style={actionContainerStyle}>
      <Button
        small={true}
        type="Primary"
        label={props.confirmLabel}
        onClick={props.onConfirm}
        style={{marginRight: globalMargins.small}}
      />
      {props.dismissable && (
        <Text type="BodyPrimaryLink" onClick={props.onDismiss}>
          Later
        </Text>
      )}
    </Box>
  </PeopleItem>
)

const actionContainerStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-start',
  alignItems: 'center',
  flexWrap: 'wrap',
}
