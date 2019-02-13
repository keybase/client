// @flow
import React from 'react'
import PeopleItem from '../item'
import {Box, Button, Icon, Text, type IconType} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

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
  <PeopleItem format="multi" badged={props.badged} icon={<Icon type={props.icon} />}>
    <Text type="Body" style={{marginRight: isMobile ? 112 : 80, marginTop: 2}}>
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
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
}
