// @flow
import * as React from 'react'
import {daysToLabel} from '../'
import {
  Box,
  Button,
  ButtonBar,
  Checkbox,
  HeaderHoc,
  Icon,
  PopupDialog,
  ScrollView,
  Text,
} from '../../../../../common-adapters'
import {globalMargins, globalStyles, isMobile, platformStyles} from '../../../../../styles'

type Props = {
  days: number,
  enabled: boolean,
  isBigTeam: boolean,
  setEnabled: boolean => void,
  onConfirm: () => void,
  onBack: () => void,
}

const iconType = isMobile ? 'icon-message-retention-64' : 'icon-message-retention-48'

const Wrapper = ({children, onBack}) =>
  isMobile ? (
    <ScrollView style={{...globalStyles.fillAbsolute, ...globalStyles.flexBoxColumn}} children={children} />
  ) : (
    <PopupDialog onClose={onBack} children={children} />
  )

const RetentionWarning = (props: Props) => {
  const policyString = daysToLabel(props.days)
  return (
    <Wrapper onBack={props.onBack}>
      <Box style={containerStyle}>
        <Icon type={iconType} style={iconStyle} />
        <Text type="Header" style={headerStyle}>
          Destroy chat messages after {policyString}?
        </Text>
        <Text type="Body" style={bodyStyle}>
          You are about to set the message deletion policy in this team's chats to{' '}
          <Text type="BodySemibold">{policyString}.</Text> This will affect all the team's channels, except
          the ones you've set manually.
        </Text>
        <Checkbox
          checked={props.enabled}
          onCheck={props.setEnabled}
          label="I understand."
          labelComponent={
            <Box style={confirmLabelStyle}>
              <Text type="Body">
                I understand that messages older than {policyString} will be deleted for everyone.
              </Text>
              <Text type="BodySmall">Channels you've set manually will not be affected.</Text>
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

const iconStyle = platformStyles({
  common: {
    marginBottom: 48,
  },
})

const headerStyle = platformStyles({
  common: {
    marginBottom: globalMargins.small,
  },
})

const bodyStyle = platformStyles({
  common: {
    marginBottom: globalMargins.small,
    textAlign: 'center',
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

export default (isMobile ? HeaderHoc(RetentionWarning) : RetentionWarning)
