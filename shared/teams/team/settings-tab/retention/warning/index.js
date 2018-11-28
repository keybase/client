// @flow
import * as React from 'react'
import {daysToLabel} from '../../../../../util/timestamp'
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
  days: number,
  enabled: boolean,
  entityType: RetentionEntityType,
  setEnabled: boolean => void,
  onConfirm: () => void,
  onBack: () => void,
}

const iconType = isMobile ? 'icon-message-retention-64' : 'icon-message-retention-48'

const Wrapper = ({children, onBack}: {children: React.Node, onBack: () => void}) =>
  isMobile ? (
    <ScrollView style={{...globalStyles.fillAbsolute, ...globalStyles.flexBoxColumn}} children={children} />
  ) : (
    <PopupDialog onClose={onBack} children={children} />
  )

const RetentionWarning = (props: Props) => {
  const policyString = daysToLabel(props.days)
  let showChannelWarnings = false
  if (props.entityType === 'big team') {
    showChannelWarnings = true
  }
  let convType: string = getConvType(props.entityType)
  return (
    <Wrapper onBack={props.onBack}>
      <Box style={containerStyle}>
        <Icon type={iconType} style={iconStyle} />
        <Text type="Header" style={headerStyle}>
          Destroy chat messages after {policyString}?
        </Text>
        <Text type="Body" style={bodyStyle}>
          You are about to set the message deletion policy in this {convType} to{' '}
          <Text type="BodySemibold">{policyString}.</Text>{' '}
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
                I understand that messages older than {policyString} will be deleted for everyone.
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
            label={isMobile ? 'Confirm' : `Yes, set to ${policyString}`}
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
    paddingBottom: globalMargins.large,
    maxWidth: 560,
  },
  isMobile: {
    paddingTop: globalMargins.small,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
  isElectron: {
    paddingTop: globalMargins.xlarge,
    paddingLeft: globalMargins.xlarge,
    paddingRight: globalMargins.xlarge,
  },
})

const iconStyle = {
  marginBottom: 48,
}

const headerStyle = platformStyles({
  common: {
    marginBottom: globalMargins.small,
    textAlign: 'center',
  },
})

const bodyStyle = platformStyles({
  common: {
    marginBottom: globalMargins.small,
    textAlign: 'center',
  },
})

const checkboxStyle = platformStyles({
  isMobile: {
    marginLeft: globalMargins.tiny,
    marginRight: globalMargins.tiny,
  },
})

const confirmLabelStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
  },
  isMobile: {
    marginBottom: globalMargins.small,
  },
  isElectron: {
    marginBottom: globalMargins.xlarge,
  },
})

export default HeaderOnMobile(RetentionWarning)
