// @flow
import React from 'react'
import {globalStyles, globalColors, transition} from '../../../styles/style-guide'
import {Icon, Text} from '../../../common-adapters'
import type {Props} from './row'

const realCSS = `
  .register-row { background-color: ${globalColors.white}; }
  .register-row:hover { background-color: ${globalColors.blue4}; }

  .register-row .register-background {  }
  .register-row:hover .register-background { opacity: 0 }

  .register-row:hover .register-icon { transform: translateX(15px)}

`

const RowCSS = () => (
  <style>{realCSS}</style>
)

const Row = ({onClick, icon, title, subTitle, children, style}:Props) => {
  return (
    <div className='register-row' style={{...stylesRowContainer, ...style}} onClick={onClick}>
      <div style={stylesIconContainer}>
        <div className='register-background' style={stylesIconBackground} />
        <Icon className='register-icon' type={icon} style={stylesIcon} />
      </div>
      <div>
        <Text type='Header' inline={false} style={stylesHeader}>{title}</Text>
        <Text type='BodySmall'>{subTitle}</Text>
        {children}
      </div>
    </div>
  )
}

const stylesRowContainer = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  transition: 'background 0.1s ease-out',
  minHeight: 100,
  maxHeight: 100,
  alignItems: 'center',
  padding: 20,
}
const stylesHeader = {
  color: globalColors.blue,
}
const stylesIconContainer = {
  ...globalStyles.flexBoxRow,
  maxWidth: 80,
  maxHeight: 80,
  minWidth: 80,
  minHeight: 80,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 25,
  position: 'relative',
}
const stylesIcon = {
  ...transition('transform'),
  fontSize: 35,
  textAlign: 'center',
  height: 'inherit',
  width: 'inherit',
  color: globalColors.black_75,
  zIndex: 1,
}
const stylesIconBackground = {
  ...transition('opacity'),
  backgroundColor: globalColors.lightGrey,
  borderRadius: 40,
  maxWidth: 80,
  maxHeight: 80,
  minWidth: 80,
  minHeight: 80,
  position: 'absolute',
  top: 0,
  left: 0,
}

export default Row
export {RowCSS}
