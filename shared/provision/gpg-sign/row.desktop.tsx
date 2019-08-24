import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalStyles, globalColors, transition, desktopStyles} from '../../styles'

type Props = {
  onClick: () => void
  icon: Kb.IconType
  title: string
  subTitle?: string
  style?: Object
  children?: any
}

const realCSS = `
  .register-row { background-color: ${globalColors.white}; }
  .register-row:hover { background-color: ${globalColors.blueLighter2}; }

  .register-row .register-background {  }
  .register-row:hover .register-background { opacity: 0 }

  .register-row:hover .register-icon { transform: translateX(15px)}

`

const RowCSS = () => <style>{realCSS}</style>

const Row = ({onClick, icon, title, subTitle, children, style}: Props) => {
  return (
    <div className="register-row" style={{...stylesRowContainer, ...style}} onClick={onClick}>
      <div style={stylesIconContainer}>
        <div className="register-background" style={stylesIconBackground} />
        <Kb.Icon
          className="register-icon"
          type={icon}
          style={stylesIcon}
          color={globalColors.black}
          fontSize={35}
        />
      </div>
      <div>
        <Kb.Text type="Header" style={stylesHeader}>
          {title}
        </Kb.Text>
        <Kb.Text type="BodySmall">{subTitle}</Kb.Text>
        {children}
      </div>
    </div>
  )
}

const stylesRowContainer = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
  maxHeight: 100,
  minHeight: 100,
  padding: 20,
  transition: 'background 0.1s ease-out',
} as any
const stylesHeader = {
  color: globalColors.blueDark,
}
const stylesIconContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 25,
  maxHeight: 80,
  maxWidth: 80,
  minHeight: 80,
  minWidth: 80,
  position: 'relative' as const,
}
const stylesIcon = {
  ...transition('transform'),
  height: 'inherit',
  textAlign: 'center',
  width: 'inherit',
  zIndex: 1,
} as const
const stylesIconBackground = {
  ...transition('opacity'),
  backgroundColor: globalColors.greyLight,
  borderRadius: 40,
  left: 0,
  maxHeight: 80,
  maxWidth: 80,
  minHeight: 80,
  minWidth: 80,
  position: 'absolute' as const,
  top: 0,
}

export default Row
export {RowCSS}
