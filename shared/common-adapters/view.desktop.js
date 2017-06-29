// @flow
import React from 'react'
import glamorous from 'glamorous'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {intersperseFn} from '../util/arrays.js'

type MarginType = $Keys<globalMargins>

type FlexTypes = 'center' | 'stretch' | 'flex-start' | 'flex-end'

type Props = {
  alignItems?: 'center',
  alignSelf?: FlexTypes,
  backgroundColor?: string,
  center?: boolean,
  children?: any,
  direction?: 'row' | 'column',
  flexGrow?: boolean,
  height?: MarginType | number | string,
  justifyContent?: FlexTypes,
  onClick?: () => void,
  padding?: MarginType,
  rowDivider?: boolean,
  scrollHorizontal?: boolean,
  scrollVertical?: boolean,
  spacing?: MarginType,
  style?: Object,
  width?: MarginType | number | string,
}

// xtiny: 4,
// tiny: 8,
// small: 16,
// medium: 24,
// large: 40,
// xlarge: 64,

const RowDivider = glamorous.div({
  borderBottom: `1px solid ${globalColors.black_05}`,
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
})

const View = (props: Props) => {
  const style = {
    ...(props.direction === 'row' ? globalStyles.flexBoxRow : globalStyles.flexBoxColumn), // default to column
    ...(props.backgroundColor ? {backgroundColor: props.backgroundColor} : null),
    ...(props.justifyContent ? {justifyContent: props.justifyContent} : null),
    ...(props.alignItems ? {alignItems: props.alignItems} : null),
    ...(props.alignSelf ? {alignSelf: props.alignSelf} : null),
    ...(props.center ? {alignItems: 'center', justifyContent: 'center'} : null),
    ...(props.scrollHorizontal || props.scrollVertical ? {overflow: 'auto'} : null),
    ...(props.onClick ? globalStyles.clickable : null),
    ...(props.flexGrow ? {flexGrow: 1} : null),
    ...(props.padding ? {padding: globalMargins[props.padding]} : null),
    ...(props.height
      ? {minHeight: typeof props.height === 'string' ? globalMargins[props.height] : props.height}
      : null),
    ...(props.width
      ? {minWidth: typeof props.width === 'string' ? globalMargins[props.width] : props.width}
      : null),
    position: 'relative',
    ...props.style,
  }
  const Div = glamorous.div(style)

  let children = props.children
  if (props.spacing) {
    const Sep = glamorous.div({height: globalMargins[props.spacing], width: globalMargins[props.spacing]})
    children = intersperseFn(index => <Sep key={index} />, props.children)
  }

  return <Div onClick={props.onClick}>{children}{props.rowDivider && <RowDivider />} </Div>
}

export default View
