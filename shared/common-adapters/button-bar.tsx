import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'

const Kb = {Box2}

type Props = {
  direction?: 'row' | 'column'
  align?: 'flex-start' | 'flex-end' | 'center' // ignored by column,,,
  children: React.ReactNode
  fullWidth?: boolean
  small?: boolean // ignored by column,,,
  style?: Styles.StylesCrossPlatform
}

const ButtonBar = (props: Props) => {
  const isColumn = (props.direction ?? 'row') === 'column'
  const Spacing = (!isColumn && props.small && !isMobile) ? SmallSpacer : BigSpacer
  const surroundSpacing = isColumn
  const children = React.Children.toArray(props.children)
  const childrenWithSpacing = children.reduce<Array<React.ReactNode>>((arr, c, idx) => {
    if (surroundSpacing || idx > 0) {
      arr.push(<Spacing key={arr.length} />)
    }
    arr.push(c)
    if (surroundSpacing && idx === children.length - 1) {
      arr.push(<Spacing key={arr.length} />)
    }
    return arr
  }, [])

  const minHeight = {
    minHeight: isMobile ? (props.small ? 64 : 72) : props.small ? 44 : 64,
  }

  // On a phone or tablet a column bar is as wide as its buttons can be (460), centered, so the
  // buttons stay centered on a window wider than that
  const style = Styles.collapseStyles([
    {
      ...(isMobile && isColumn ? columnMobileStyle : Styles.isTablet ? tabletStyle : {}),
      ...(!isColumn
        ? {
            justifyContent: props.align ?? 'center',
            ...minHeight,
          }
        : undefined),
    },
    props.style,
  ])

  return (
    <Kb.Box2
      direction={isColumn ? 'vertical' : 'horizontal'}
      fullWidth={true}
      alignItems={(props.fullWidth ?? false) ? 'stretch' : 'center'}
      style={style}
    >
      {childrenWithSpacing}
    </Kb.Box2>
  )
}

const tabletStyle = {maxWidth: 460} as const
const columnMobileStyle = {alignSelf: 'center', maxWidth: 460} as const

// Note explicitly not using globalMargins here. We don't necessarily want this spacing to change ever
const BigSpacer = () => <Kb.Box2 direction="vertical" noShrink={true} style={bigSpacerStyle} />
const bigSpacerStyle = Styles.size(8)
const SmallSpacer = () => <Kb.Box2 direction="vertical" noShrink={true} style={smallSpacerStyle} />
const smallSpacerStyle = Styles.size(isMobile ? 8 : 4)

export default ButtonBar
