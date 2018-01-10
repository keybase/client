// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

export type Props = {
  onReadMore: () => void,
  onHideBanner?: () => void,
}

const Banner = ({onReadMore, onHideBanner}: Props) => (
  <Box
    style={{
      ...(isMobile
        ? {
            ...globalStyles.flexBoxColumn,
            padding: 24,
          }
        : {
            ...globalStyles.flexBoxRow,
            height: 256,
          }),
      alignItems: 'center',
      backgroundColor: globalColors.blue,
      flexShrink: 0,
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxColumn, margin: globalMargins.small}}>
      <Icon type="icon-illustration-subteams-380" />
    </Box>

    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...(isMobile ? {alignItems: 'center'} : {marginLeft: globalMargins.medium, maxWidth: 330}),
      }}
    >
      <Text
        backgroundMode="Terminal"
        type="BodySemibold"
        style={{marginBottom: globalMargins.small, ...(isMobile ? {textAlign: 'center'} : {})}}
      >
        Subteams are cryptographically distinct, and can welcome people who aren't elsewhere in your team
        hierarchy. Some random ideas:
      </Text>
      <Text backgroundMode="Terminal" type="BodySemibold">
        • stripe.devops
      </Text>
      <Text backgroundMode="Terminal" type="BodySemibold">
        • stripe.legal
      </Text>
      <Text backgroundMode="Terminal" type="BodySemibold">
        • stripe.customers.nike
      </Text>

      <Text
        style={{marginTop: globalMargins.small}}
        backgroundMode="Terminal"
        type="BodySemiboldLink"
        className="underline"
        onClick={onReadMore}
      >
        Read more about subteams
      </Text>
    </Box>
    {onHideBanner && (
      <Box style={closeIconStyle}>
        <Icon type="iconfont-close" onClick={onHideBanner} />
      </Box>
    )}
  </Box>
)

let closeIconStyle = {
  position: 'absolute',
  ...(isMobile
    ? {
        right: globalMargins.small,
        top: globalMargins.small,
        height: 14,
        width: 14,
      }
    : {
        right: globalMargins.tiny,
        top: globalMargins.tiny,
      }),
}

export default Banner
