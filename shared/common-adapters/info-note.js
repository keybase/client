// @flow
import * as React from 'react'
import Box, {Box2} from './box'
import Icon from './icon'
import {collapseStyles, globalColors, styleSheetCreate, type StylesCrossPlatform} from '../styles'
import {isMobile} from '../constants/platform'

export type Props = {
  containerStyle?: StylesCrossPlatform,
  children: React.Node,
}

const InfoNote = (props: Props) => (
  <Box2 direction="vertical" gap="xtiny" style={collapseStyles([styles.alignCenter, props.containerStyle])}>
    <Box2 direction="horizontal" gap="tiny" style={styles.alignCenter}>
      <Box style={{backgroundColor: globalColors.black_10, height: 1, width: 24}} />
      <Icon color={globalColors.black_10} type="iconfont-info" fontSize={isMobile ? 22 : 16} />
      <Box style={{backgroundColor: globalColors.black_10, height: 1, width: 24}} />
    </Box2>
    {props.children}
  </Box2>
)

const styles = styleSheetCreate({
  alignCenter: {
    alignItems: 'center',
  },
})

export default InfoNote
