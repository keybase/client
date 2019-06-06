import * as React from 'react'
import Box, {Box2} from './box'
import Icon from './icon'
import * as Styles from '../styles'

export type Props = {
  containerStyle?: Styles.StylesCrossPlatform
  children?: React.ReactNode
  color?: string | null
}

const InfoNote = (props: Props) => (
  <Box2
    direction="vertical"
    gap="xtiny"
    style={Styles.collapseStyles([styles.alignCenter, props.containerStyle])}
  >
    <Box2 direction="horizontal" gap="tiny" style={styles.alignCenter}>
      <Box style={{backgroundColor: props.color || Styles.globalColors.black_10, height: 1, width: 24}} />
      <Icon
        color={props.color || Styles.globalColors.black_10}
        type="iconfont-info"
        fontSize={Styles.isMobile ? 22 : 16}
      />
      <Box style={{backgroundColor: props.color || Styles.globalColors.black_10, height: 1, width: 24}} />
    </Box2>
    {props.children}
  </Box2>
)

const styles = Styles.styleSheetCreate({
  alignCenter: {
    alignItems: 'center',
  },
})

export default InfoNote
