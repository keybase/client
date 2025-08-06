import * as React from 'react'
import * as Styles from '@/styles'
import Box from './box'

const Kb = {Box}

type Props = {
  direction?: 'row' | 'column'
  align?: 'flex-start' | 'flex-end' | 'center' // ignored by column,,,
  children: React.ReactNode
  fullWidth?: boolean
  small?: boolean // ignored by column,,,
  style?: Styles.StylesCrossPlatform
}

const ButtonBar = (props: Props) => {
  const _spacing = () => {
    if ((props.direction ?? 'row') === 'row' && props.small && !Styles.isMobile) {
      return SmallSpacer
    }
    return BigSpacer
  }

  const _surroundSpacing = () => {
    return (props.direction ?? 'row') === 'column'
  }

  const Spacing = _spacing()
  const surroundSpacing = _surroundSpacing()
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
    minHeight: Styles.isMobile ? (props.small ? 64 : 72) : props.small ? 44 : 64,
  }

  const style = Styles.collapseStyles([
    {
      alignItems: (props.fullWidth ?? false) ? 'stretch' : 'center',
      width: '100%',
      ...(Styles.isTablet ? {maxWidth: 460} : {}),
      ...((props.direction ?? 'row') === 'column'
        ? {...Styles.globalStyles.flexBoxColumn}
        : {
            ...Styles.globalStyles.flexBoxRow,
            justifyContent: props.align ?? 'center',
            ...minHeight,
          }),
    },
    props.style,
  ])

  return <Kb.Box style={style}>{childrenWithSpacing}</Kb.Box>
}

// Note explicitly not using globalMargins here. We don't necessarily want this spacing to change ever
const BigSpacer = () => <Kb.Box style={bigSpacerStyle} />
const bigSpacerStyle = {
  flexShrink: 0,
  height: 8,
  width: 8,
}
const SmallSpacer = () => <Kb.Box style={smallSpacerStyle} />
const smallSpacerStyle = {
  flexShrink: 0,
  height: Styles.isMobile ? 8 : 4,
  width: Styles.isMobile ? 8 : 4,
}

export default ButtonBar
