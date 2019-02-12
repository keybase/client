// @flow
import * as React from 'react'
import {
  Box,
  Button,
  ButtonBar,
  Checkbox,
  HeaderOnMobile,
  Icon,
  PopupDialog,
  ScrollView,
  Text,
} from '../../../../../common-adapters'
import {globalMargins, globalStyles, isMobile, platformStyles} from '../../../../../styles'
import type {RetentionEntityType} from '..'

type Props = {
  enabled: boolean,
  entityType: RetentionEntityType,
  exploding: boolean,
  setEnabled: boolean => void,
  timePeriod: string,
  onConfirm: () => void,
  onBack: () => void,
}

const iconType = isMobile ? 'icon-message-retention-64' : 'icon-message-retention-48'
const explodeIconType = 'icon-illustration-exploding-messages-240'

const Wrapper = ({children, onBack}: {children: React.Node, onBack: () => void}) =>
  isMobile ? (
    <ScrollView style={{...globalStyles.fillAbsolute, ...globalStyles.flexBoxColumn}} children={children} />
  ) : (
    <PopupDialog onClose={onBack} children={children} />
  )

const RetentionWarning = (props: Props) => {
  let showChannelWarnings = false
  if (props.entityType === 'big team') {
    showChannelWarnings = true
  }
  let convType: string = getConvType(props.entityType)
  return (
    <Wrapper onBack={props.onBack}>
      <Box style={containerStyle}>
        <Icon type={props.exploding ? explodeIconType : iconType} style={iconStyle} />
        <Text center={true} type="Header" style={headerStyle}>
          {props.exploding ? 'Explode' : 'Destroy'} chat messages after {props.timePeriod}?
        </Text>
        <Text center={true} type="Body" style={bodyStyle}>
          You are about to set the messages in this {convType} to{' '}
          {props.exploding ? 'explode after ' : 'be deleted after '}
          <Text type="BodySemibold">{props.timePeriod}.</Text>{' '}
          {showChannelWarnings &&
            "This will affect all the team's channels, except the ones you've set manually."}
        </Text>
        <Checkbox
          checked={props.enabled}
          onCheck={props.setEnabled}
          style={checkboxStyle}
          label=""
          labelComponent={
            <Box style={confirmLabelStyle}>
              <Text type="Body">
                I understand that messages older than {props.timePeriod} will be deleted for everyone.
              </Text>
              {showChannelWarnings && (
                <Text type="BodySmall">Channels you've set manually will not be affected.</Text>
              )}
            </Box>
          }
        />
        <ButtonBar>
          <Button type="Secondary" onClick={props.onBack} label="Cancel" />
          <Button
            type="Danger"
            onClick={props.onConfirm}
            label={isMobile ? 'Confirm' : `Yes, set to ${props.timePeriod}`}
            disabled={!props.enabled}
          />
        </ButtonBar>
      </Box>
    </Wrapper>
  )
}

const getConvType = (entityType: RetentionEntityType) => {
  let convType = ''
  switch (entityType) {
    case 'small team':
      convType = "team's chat"
      break
    case 'big team':
      convType = "team's chat"
      break
    case 'channel':
      convType = 'channel'
      break
    case 'adhoc':
      convType = 'conversation'
      break
  }
  if (convType === '') {
    throw new Error(`RetentionWarning: impossible entityType encountered: ${entityType}`)
  }
  return convType
}

const containerStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    maxWidth: 560,
    paddingBottom: globalMargins.large,
  },
  isElectron: {
    paddingLeft: globalMargins.xlarge,
    paddingRight: globalMargins.xlarge,
    paddingTop: globalMargins.xlarge,
  },
  isMobile: {
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.small,
  },
})

const iconStyle = {marginBottom: 20}
const headerStyle = {marginBottom: globalMargins.small}
const bodyStyle = {marginBottom: globalMargins.small}
const checkboxStyle = platformStyles({
  isMobile: {
    marginLeft: globalMargins.tiny,
    marginRight: globalMargins.tiny,
  },
})

const confirmLabelStyle = platformStyles({
  common: {...globalStyles.flexBoxColumn},
  isElectron: {marginBottom: globalMargins.xlarge},
  isMobile: {marginBottom: globalMargins.small},
})

export default HeaderOnMobile(RetentionWarning)
