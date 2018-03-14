// @flow
import * as React from 'react'
import {Box, Button, ButtonBar, ClickableBox, Icon, Text} from '../../../common-adapters'
import {type IconType} from '../../../common-adapters/icon.constants'
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

const CaptionedDangerIcon = ({
  icon,
  caption,
  onClick,
}: {
  icon: IconType,
  caption: string,
  onClick: () => void,
}) => (
  <ClickableBox
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={onClick}
  >
    <Icon type={icon} style={{color: globalColors.red, marginRight: globalMargins.tiny}} />
    <Text type="BodySemibold" style={{color: globalColors.red}} className="hover-underline">
      {caption}
    </Text>
  </ClickableBox>
)

export {CaptionedButton, DangerButton, CaptionedDangerIcon}
