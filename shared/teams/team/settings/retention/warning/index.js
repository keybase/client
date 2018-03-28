// @flow
import * as React from 'react'
import {daysToLabel} from '../../../../../util/timestamp'
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
  isSmallTeam: boolean, // TODO DESKTOP-6376 use this in conjunction with isTeamWide to decide on wording
  isTeamWide: boolean,
  isTeam: boolean,
  setEnabled: boolean => void,
  onConfirm: () => void,
  onCancel: () => void,
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
  let convType = "team's channels"
  if (!props.isTeam) {
    convType = 'conversation'
  } else if (!props.isTeamWide) {
    convType = 'channel'
  } else if (props.isTeam) {
    convType = 'team'
  }
  return (
    <Wrapper onBack={props.onCancel}>
      <Box style={containerStyle}>
        <Icon type={iconType} style={iconStyle} />
        <Text type="Header" style={headerStyle}>
          Destroy chat messages after {policyString}?
        </Text>
        <Text type="Body" style={bodyStyle}>
          You are about to set the message deletion policy in this {convType} to{' '}
          <Text type="BodySemibold">{policyString}.</Text>{' '}
          {props.isTeamWide &&
            !props.isSmallTeam && (
              <Text type="Body">
                This will affect all the team's channels, except the ones you've set manually.
              </Text>
            )}
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
              {props.isTeamWide &&
                !props.isSmallTeam && (
                  <Text type="BodySmall">Channels you've set manually will not be affected.</Text>
                )}
            </Box>
          }
        />
        <ButtonBar>
          <Button type="Secondary" onClick={props.onCancel} label="Cancel" />
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
