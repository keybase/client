import type * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Button from './button'
import Icon from './icon'
import IconAuto from './icon-auto'
import Text from './text'
import type {IconType} from './icon.constants-gen'

export type EmptyStateProps = {
  action?: {
    label: string
    mode?: 'Primary' | 'Secondary'
    onClick: () => void
  }
  centerChildren?: boolean
  children?: React.ReactNode
  gap?: keyof typeof Styles.globalMargins
  // fancy illustration image; wins over icon if both are passed
  illustration?: IconType
  icon?: IconType
  style?: Styles.StylesCrossPlatform
  text?: string
  textType?: 'Body' | 'BodySmall'
  title?: string
}

const EmptyState = (props: EmptyStateProps) => {
  const {action, centerChildren = true, children, gap = 'small', icon, illustration} = props
  const {style, text, textType = 'Body', title} = props
  return (
    <Box2
      direction="vertical"
      centerChildren={centerChildren}
      fullWidth={true}
      gap={gap}
      style={Styles.collapseStyles([Styles.globalStyles.flexGrow, style])}
    >
      {illustration ? <IconAuto type={illustration} /> : null}
      {!illustration && icon ? (
        <Icon color={Styles.globalColors.black_20} fontSize={48} type={icon} />
      ) : null}
      {title ? (
        <Text center={true} type="Header">
          {title}
        </Text>
      ) : null}
      {text ? (
        <Text center={true} type={textType}>
          {text}
        </Text>
      ) : null}
      {children}
      {action ? (
        <Button
          type="Default"
          mode={action.mode ?? 'Secondary'}
          label={action.label}
          onClick={action.onClick}
        />
      ) : null}
    </Box2>
  )
}

export default EmptyState
