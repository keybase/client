import type * as React from 'react'
import {Box2} from './box'
import Icon from './icon'
import * as Styles from '@/styles'

export type Props = {
  containerStyle?: Styles.StylesCrossPlatform
  children?: React.ReactNode
  color?: string
}

const InfoNote = (props: Props) => {
  const lineStyle = Styles.collapseStyles([styles.line, props.color ? {backgroundColor: props.color} : undefined])
  return (
    <Box2
      direction="vertical"
      gap="xtiny"
      alignItems="center"
      style={props.containerStyle}
    >
      <Box2 direction="horizontal" gap="tiny" alignItems="center">
        <Box2 direction="vertical" style={lineStyle} />
        <Icon
          color={props.color || Styles.globalColors.black_10}
          type="iconfont-info"
          fontSize={isMobile ? 22 : 16}
        />
        <Box2 direction="vertical" style={lineStyle} />
      </Box2>
      {props.children}
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  line: {
    backgroundColor: Styles.globalColors.black_10,
    height: 1,
    width: 24,
  },
}))

export default InfoNote
