// @flow
import * as React from 'react'
import {Box, Button, ButtonBar, Text} from '../../../common-adapters'
import {globalMargins, globalStyles} from '../../../styles'

const CaptionedButton = (props: {label: string, caption: string, onClick: () => void}) => (
  <Box style={{...globalStyles.flexBoxColumn}}>
    <Button type="Primary" small={true} label={props.label} onClick={props.onClick} />
    <Text
      style={{
        marginTop: globalMargins.xtiny,
        textAlign: 'center',
      }}
      type="BodySmall"
    >
      {props.caption}
    </Text>
  </Box>
)

const DangerButton = (props: {label: string, onClick: () => void}) => (
  <ButtonBar small={true}>
    <Button type="Danger" small={true} label={props.label} onClick={props.onClick} />
  </ButtonBar>
)

export {CaptionedButton, DangerButton}
