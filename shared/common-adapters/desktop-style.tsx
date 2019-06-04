import * as React from 'react'
import * as Styles from '../styles'
const DesktopStyle = ({style: styleStr}: {style: string}) =>
  Styles.isMobile ? null : <style>{styleStr}</style>
export default DesktopStyle
