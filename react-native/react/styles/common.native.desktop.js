export default {
  navBarHeight: 0,
  tabBarHeight: 0
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
  }
}
