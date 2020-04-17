/** reduce some extra stuff from the snapshots which make it too big **/
module.exports = {
  print(val, serialize, indent) {
    const {props} = val
    switch (val.type) {
      case 'View': {
        const propsToRemove = [
          'accessible',
          'isTVSelectable',
          'onClick',
          'onResponderGrant',
          'onResponderMove',
          'onResponderRelease',
          'onResponderTerminate',
          'onResponderTerminationRequest',
          'onStartShouldSetResponder',
          'sourceJson',
        ]

        propsToRemove.forEach(p => delete props[p])

        if (props.pointerEvents === 'auto') {
          delete props.pointerEvents
        }
        if (props.collapsable === true) {
          delete props.collapsable
        }
      }
      case 'RCTScrollView': {
        const propsToRemove = [
          'data',
          'debug',
          'disableVirtualization',
          'getItem',
          'getItemCount',
          'horizontal',
          'initialNumToRender',
          'keyExtractor',
          'keyboardShouldPersistTaps',
          'maxToRenderPerBatch',
          'numColumns',
          'onContentSizeChange',
          'onEndReachedThreshold',
          'onLayout',
          'onMomentumScrollEnd',
          'onScroll',
          'onScrollBeginDrag',
          'onScrollEndDrag',
          'removeClippedSubviews',
          'renderItem',
          'sections',
          'scrollEventThrottle',
          'stickyHeaderIndices',
          'updateCellsBatchingPeriod',
          'viewabilityConfigCallbackPairs',
          'windowSize',
        ]

        propsToRemove.forEach(p => delete props[p])
      }
    }

    val.markedSmaller = true
    return serialize(val)
  },

  test(val) {
    if (val) {
      if (val.type === 'View' && !val.markedSmaller) {
        return true
      }
      if (val.type === 'RCTScrollView' && !val.markedSmaller) {
        return true
      }
    }

    return false
  },
}
