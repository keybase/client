export default {
  navBarHeight: 0,
  tabBarHeight: 0,
}

const flexBox = {
  display: 'flex',
}

const button = {
  borderRadius: 61,
  color: 'white',
  fontSize: 18,
  fontWeight: 'normal',
  height: 32,
  lineHeight: '32px',
  textTransform: 'none',
  width: 123,
}

export const styles = {
  clickable: {
    cursor: 'pointer',
  },
  windowDragging: { // allow frameless window dragging
    WebkitAppRegion: 'drag',
  },
  windowDraggingClickable: { // allow things in frameless regions to be clicked and not dragged
    WebkitAppRegion: 'no-drag',
  },
  button,
  primaryButton: {
    ...button,
    backgroundColor: '#86e2f9',
  },
  secondaryButton: {
    ...button,
    backgroundColor: '#ffa9a9',
    marginRight: 7,
  },
  noWrapCheckboxLabel: {
    width: 'initial',
  },
  noSelect: {
    WebkitUserSelect: 'none',
  },
  flexBoxColumn: {
    ...flexBox,
    flexDirection: 'column',
  },
  flexBoxRow: {
    ...flexBox,
    flexDirection: 'row',
  },
  vr: {
    maxWidth: 1,
    minWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  hr: {
    minHeight: 1,
    maxHeight: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  loadingContainer: {
    backgroundColor: '#F7F7F7',
  },
}

export function sheet (obj) {
  return obj
}
