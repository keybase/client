// @flow
import * as React from 'react'
import {Badge, Box, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import moment from 'moment'
import {isMobile} from '../../constants/platform'

// Update moment locale for relative time strings
moment.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: 'now',
    ss: '%ds',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    M: '1mo',
    MM: '%dmo',
    y: '1y',
    yy: '%dy',
  },
})

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
      ...globalStyles.flexBoxRow,
      backgroundColor: props.badged ? globalColors.blue4 : globalColors.white,
      paddingTop: globalMargins.tiny,
      paddingLeft: 12,
      paddingBottom: globalMargins.tiny,
      position: 'relative',
    }}
  >
    <Box style={{marginRight: 20, width: isMobile ? 48 : 32}}>{props.icon}</Box>
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        paddingRight: isMobile ? 100 : 80,
        width: 'auto',
        overflow: 'hidden',
        position: 'relative',
        ...props.contentStyle,
      }}
    >
      {props.children}
    </Box>
    <Box style={{...globalStyles.flexBoxRow, position: 'absolute', alignItems: 'center', right: 8, top: 12}}>
      {!!props.when && (
        <Text type="BodySmall" style={{}}>
          {moment(props.when).fromNow(true)}
        </Text>
      )}
      {props.badged && (
        <Badge
          badgeNumber={null}
          badgeStyle={{marginLeft: globalMargins.tiny, height: 10, minWidth: 10, marginTop: -1}}
        />
      )}
    </Box>
  </Box>
)
