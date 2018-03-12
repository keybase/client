// @flow
import * as React from 'react'
import {Box, Button, ButtonBar, Icon, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

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

const LeaveChannel = ({onLeave}: {onLeave: () => void}) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={onLeave}
  >
    <Icon type="iconfont-team-leave" style={{color: globalColors.red, marginRight: globalMargins.tiny}} />
    <Text type="BodySemibold" style={{color: globalColors.red}}>
      Leave channel
    </Text>
  </Box>
)

export {CaptionedButton, DangerButton, LeaveChannel}
