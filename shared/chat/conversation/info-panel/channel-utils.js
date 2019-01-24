// @flow
import * as React from 'react'
import {
  Box,
  Button,
  ButtonBar,
  ClickableBox,
  Icon,
  Text,
  type IconType,
  WaitingButton,
} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

const CaptionedButton = (props: {
  label: string,
  caption: string,
  onClick: () => void,
  waitOnClick?: boolean,
}) => (
  <Box style={{...globalStyles.flexBoxColumn}}>
    {props.waitOnClick ? (
      <WaitingButton
        type="Primary"
        small={true}
        label={props.label}
        onClick={props.onClick}
        waitingKey={null}
      />
    ) : (
      <Button type="Primary" small={true} label={props.label} onClick={props.onClick} />
    )}
    <Text center={true} style={{marginTop: globalMargins.xtiny}} type="BodySmall">
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
      paddingBottom: globalMargins.tiny,
      paddingTop: globalMargins.tiny,
    }}
    onClick={onClick}
  >
    <Icon type={icon} style={{marginRight: globalMargins.tiny}} color={globalColors.red} />
    <Text type="BodySemibold" style={{color: globalColors.red}} className="hover-underline">
      {caption}
    </Text>
  </ClickableBox>
)

export {CaptionedButton, DangerButton, CaptionedDangerIcon}
