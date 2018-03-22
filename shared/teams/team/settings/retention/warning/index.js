// @flow
import * as React from 'react'
import {daysToLabel} from '../'
import {Box, Icon, PopupDialog, ScrollView, Text} from '../../../../../common-adapters'
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
  return (
    <Wrapper onBack={props.onBack}>
      <Box style={containerStyle}>
        <Icon type={iconType} style={iconStyle} />
        <Text type="Header" style={headerStyle}>
          Destroy chat messages after {daysToLabel(props.days)}?
        </Text>
        <Text type="Body" style={bodyStyle}>
          You are about to set the message deletion in this team's chats to{' '}
          <Text type="BodySemibold">{daysToLabel(props.days)}.</Text> This will affect all the team's
          channels, except the ones you've set manually.
        </Text>
      </Box>
    </Wrapper>
  )
}

const containerStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    padding: globalMargins.medium,
    maxWidth: 560,
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
    marginLeft: globalMargins.xlarge,
    marginRight: globalMargins.xlarge,
    textAlign: 'center',
  },
})

export default RetentionWarning
