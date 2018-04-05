// @flow
import * as React from 'react'
import type {RetentionPolicy} from '../../../../constants/types/teams'
import {Box, Icon, Text} from '../../../../common-adapters/'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'

export type Props = {
  canChange: boolean,
  policy: RetentionPolicy,
  teamPolicy: RetentionPolicy,
  teamType: 'small' | 'big' | 'adhoc',
}

const iconType = isMobile ? 'icon-message-retention-48' : 'icon-message-retention-32'

export default (props: Props) => {
  if (
    props.policy.type === 'retain' ||
    (props.policy.type === 'inherit' && props.teamPolicy.type === 'retain')
  ) {
    return null
  }

  let convType = 'chat'
  if (props.teamType === 'big') {
    convType = 'channel'
  }
  let explanation = ''
  switch (props.policy.type) {
    case 'expire':
      explanation = `are destroyed after ${props.policy.days} days.`
      break
    case 'inherit':
      explanation += props.teamType === 'small' ? '.' : ', the team default.'
      break
  }
  const notice = `Messages in this ${convType} ${explanation}`
  return (
    <Box style={containerStyle}>
      <Icon type={iconType} style={iconStyle} />
      <Text type="BodySmallSemibold">{notice}</Text>
    </Box>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue5,
  paddingBottom: globalMargins.small,
  paddingTop: globalMargins.small,
  width: '100%',
}

const iconStyle = {
  marginBottom: globalMargins.tiny,
}
