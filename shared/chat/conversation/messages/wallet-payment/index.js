// @flow
import * as React from 'react'
import {Box2, Icon, Markdown, Text} from '../../../../common-adapters'
import {collapseStyles, globalColors, styleSheetCreate} from '../../../../styles'

export type Props = {}

export default (props: Props) => {
  return (
    <Box2 direction="vertical" gap="xtiny" gapEnd={true}>
      <Box2 direction="horizontal" fullWidth={true} style={styles.headingContainer}>
        <Box2 direction="horizontal" gap="xtiny" style={collapseStyles([styles.headingContainer, {flex: 1}])}>
          <Icon type="iconfont-time" color={globalColors.purple2} fontSize={12} />
          <Text type="BodySmall" style={styles.purple}>
            sent Lumens worth{' '}
            <Text type="BodySmallExtrabold" style={styles.purple}>
              $35
            </Text>
            .
          </Text>
        </Box2>
        <Box2 direction="horizontal">
          <Text type="BodyExtrabold" style={{color: globalColors.red}}>
            -90.5700999 XLM
          </Text>
        </Box2>
      </Box2>
      <Markdown allowFontScaling={true}>:beer:</Markdown>
    </Box2>
  )
}

const styles = styleSheetCreate({
  headingContainer: {
    alignItems: 'center',
  },
  purple: {color: globalColors.purple2},
})
