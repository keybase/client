import * as React from 'react'
import DesktopStyle from './desktop-style'
import {Box2} from './box'
import * as Styles from '../styles'

type Props = {
  containerStyle?: Styles.StylesCrossPlatform
  hoverContainerStyle?: Styles.StylesCrossPlatform
}

// HoverHoc for swapping components out on hover
// Uses visibility and doesn't mount/unmount components
export default (
  DefaultComponent: React.ComponentType<{}>,
  HoverComponent: React.ComponentType<{}>
): React.ComponentType<Props> => (props: Props) => {
  const realCSS = `
    .hoverContainer { position: relative; }
    .hoverContainer .hoverComponent { visibility: hidden; position: absolute; top: 0; }
    .hoverContainer:hover .defaultComponent { visibility: hidden; }
    .hoverContainer:hover .hoverComponent { visibility: visible; }
  `

  return (
    <Box2 direction="vertical" className="hoverContainer" style={props.containerStyle}>
      <DesktopStyle style={realCSS} />
      <Box2 direction="horizontal" className="defaultComponent">
        <DefaultComponent />
      </Box2>
      {!Styles.isMobile && (
        <Box2 direction="horizontal" className="hoverComponent" style={props.hoverContainerStyle}>
          <HoverComponent />
        </Box2>
      )}
    </Box2>
  )
}
