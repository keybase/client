// @flow
import * as React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'
import {formatTimeForPeopleItem} from '../../util/timestamp'

export type Props = {
  badged: boolean,
  icon: React.Node,
  children: React.Node,
  when?: Date,
  contentStyle?: any,
}

export default (props: Props) => (
  <Box
    style={{
      ...containerStyle,
      backgroundColor: props.badged ? globalColors.blue4 : globalColors.white,
      borderBottomColor: props.badged ? globalColors.white : globalColors.black_10,
    }}
  >
    <Box style={iconContainerStyle}>{props.icon}</Box>
    <Box
      style={{
        ...childrenContainerStyle,
        ...props.contentStyle,
      }}
    >
      {props.children}
    </Box>
    <Box style={timestampContainerStyle}>
      {!!props.when && <Text type="BodySmall">{formatTimeForPeopleItem(props.when.getTime())}</Text>}
      {props.badged && <Box style={badgeStyle} />}
    </Box>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  paddingTop: globalMargins.tiny,
  paddingLeft: 12,
  paddingBottom: globalMargins.tiny,
  position: 'relative',
  borderBottomWidth: 1,
  ...(isMobile ? null : {borderStyle: 'solid'}),
}

const iconContainerStyle = {marginRight: 20, width: isMobile ? 48 : 32}

const childrenContainerStyle = {
  ...globalStyles.flexBoxColumn,
  paddingRight: isMobile ? 100 : 80,
  width: 'auto',
  overflow: 'hidden',
  position: 'relative',
}

const timestampContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  position: 'absolute',
  right: 8,
  top: 12,
}

const badgeStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginLeft: globalMargins.xtiny,
  marginTop: isMobile ? 3 : 1,
  width: 8,
}
