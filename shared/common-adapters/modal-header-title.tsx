import type * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Text from './text'

export type ModalHeaderTitleProps = {
  title: string
  // a small line over the title, like the team a team modal acts on
  subtitle?: string
  // desktop only: a 16px avatar before the subtitle
  avatar?: React.ReactNode
}

// A modal route's headerTitle. Fits the 48px desktop modal header: one Header line, or a
// subtitle row (avatar + BodyTiny) over it.
const ModalHeaderTitle = (props: ModalHeaderTitleProps) => {
  const {title, subtitle, avatar} = props
  const styles = useStyles()
  if (isMobile) {
    return (
      <Box2 direction="vertical" alignItems="center">
        {!!subtitle && (
          <Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
            {subtitle}
          </Text>
        )}
        <Text type="BodyBig">{title}</Text>
      </Box2>
    )
  }
  if (!subtitle && !avatar) {
    return (
      <Text type="Header" lineClamp={1} center={true}>
        {title}
      </Text>
    )
  }
  return (
    <Box2 direction="vertical" alignItems="center" style={styles.stack}>
      <Box2 direction="horizontal" alignItems="center" gap="xtiny" style={styles.subtitleRow}>
        {avatar}
        {!!subtitle && (
          <Text type="BodyTiny" lineClamp={1}>
            {subtitle}
          </Text>
        )}
      </Box2>
      <Text type="Header" lineClamp={1} center={true} style={styles.title}>
        {title}
      </Text>
    </Box2>
  )
}

const useStyles = Styles.createStyleHook(() => ({
  stack: {maxWidth: '100%', minWidth: 0},
  subtitleRow: {maxWidth: '100%', minWidth: 0},
  title: {maxWidth: '100%'},
}))

export default ModalHeaderTitle
