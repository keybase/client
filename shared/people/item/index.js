// @flow
import * as React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import moment from 'moment'
import {isMobile} from '../../constants/platform'

// Update moment locale for relative time strings
moment.locale('shortTime', {
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
const formatter = moment()
moment.locale('en')

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
      borderBottomWidth: 1,
      borderBottomColor: props.badged ? globalColors.white : globalColors.black_05,
      borderBottomStyle: 'solid',
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
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        position: 'absolute',
        alignItems: 'center',
        right: 8,
        top: 12,
      }}
    >
      {!!props.when && (
        <Text type="BodySmall" style={{}}>
          {formatter.set(moment(props.when).toObject()).fromNow(true)}
        </Text>
      )}
      {props.badged && (
        <Box
          style={{
            backgroundColor: globalColors.orange,
            borderRadius: 6,
            height: 8,
            marginLeft: globalMargins.xtiny,
            marginTop: isMobile ? 3 : 1,
            width: 8,
          }}
        />
      )}
    </Box>
  </Box>
)
