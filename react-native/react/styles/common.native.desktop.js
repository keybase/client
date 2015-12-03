export default {
  navBarHeight: 0,
  tabBarHeight: 0
}

const button = {
  borderRadius: 61,
  color: 'white',
  fontSize: 18,
  fontWeight: 'normal',
  height: 32,
  lineHeight: '32px',
  textTransform: 'none',
  width: 123
}

export const styles = {
  clickable: {
    cursor: 'pointer'
  },
  windowDragging: { // allow frameless window dragging
    WebkitAppRegion: 'drag'
  },
  windowDraggingClickable: { // allow things in frameless regions to be clicked and not dragged
    WebkitAppRegion: 'no-drag'
  },
  button,
  primaryButton: {
    ...button,
    backgroundColor: '#86e2f9'
  },
  secondaryButton: {
    ...button,
    backgroundColor: '#ffa9a9',
    marginRight: 7
  },
  noWrapCheckboxLabel: {
    width: 'initial'
  },
  noSelect: {
    WebkitUserSelect: 'none'
  }
}
