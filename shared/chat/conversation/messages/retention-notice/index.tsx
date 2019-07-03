import * as React from 'react'
import {Box, Icon, Text} from '../../../../common-adapters/'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'

export type Props = {
  canChange: boolean
  onChange: () => void
  explanation: string
}

const iconType = isMobile ? 'icon-message-retention-48' : 'icon-message-retention-32'

export default (props: Props) => {
  return (
    <Box style={containerStyle}>
      <Icon type={iconType} style={iconStyle} />
      <Text center={true} type="BodySmallSemibold">
        {props.explanation}
      </Text>
      {props.canChange && (
        <Text type="BodySmallSemibold" style={{color: globalColors.blueDark}} onClick={props.onChange}>
          Change this
        </Text>
      )}
    </Box>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blueLighter3,
  paddingBottom: globalMargins.small,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.small,
  width: '100%',
}

const iconStyle = {
  height: isMobile ? 48 : 32,
  marginBottom: globalMargins.tiny,
  width: isMobile ? 48 : 32,
}
