import * as React from 'react'
import {View, type NativeSyntheticEvent, type NativeTouchEvent} from 'react-native'
import * as Kb from '@/common-adapters'
import type {Props} from './alphabet-index'

const stubTrue = () => true
const initMeasureRef = {height: -1, pageY: -1}
const isValidMeasure = (m: typeof initMeasureRef) => m.height >= 0 && m.pageY >= 0
const updateMeasure = (m: typeof initMeasureRef, newM: typeof initMeasureRef) =>
  isValidMeasure(newM) ? newM : m

const AlphabetIndex = (props: Props) => {
  const topSectionRef = React.useRef<View>(null)
  const sectionMeasureRef = React.useRef<{height: number; pageY: number}>(initMeasureRef)
  const currIndex = React.useRef<number>(-1)

  // This timeout is long because our ref is set before the screen transition
  // finishes. Transition must be finished so we get accurate coords.
  const storeMeasure = Kb.useTimeout(() => {
    topSectionRef.current?.measure((_x, _y, _width, height, _pageX, pageY) => {
      sectionMeasureRef.current = updateMeasure(sectionMeasureRef.current, {height, pageY})
    })
  }, 200)

  React.useEffect(() => {
    storeMeasure()
  }, [storeMeasure, props.measureKey])

  const {labels, onScroll, showNumSection} = props
  const handleTouch = React.useCallback(
    (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
      if (isValidMeasure(sectionMeasureRef.current)) {
        const measure = sectionMeasureRef.current
        const touch = evt.nativeEvent.touches[0]
        if (!touch) return
        const index = Math.floor((touch.pageY - measure.pageY) / measure.height)
        if (index >= 0 && index < labels.length && index !== currIndex.current) {
          currIndex.current = index
          onScroll(labels[index] ?? '')
        }
        if (showNumSection && index >= labels.length && index < labels.length + 3) {
          // last three are the '0 • 9'
          onScroll('numSection')
        }
      }
    },
    [labels, onScroll, showNumSection]
  )

  const clearTouch = React.useCallback(() => {
    currIndex.current = -1
  }, [])

  return (
    <View
      style={Kb.Styles.collapseStyles([styles.container, props.style])}
      onStartShouldSetResponder={stubTrue}
      onMoveShouldSetResponder={stubTrue}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={clearTouch}
    >
      {/* It's assumed that every row is the same height */}
      {labels.map((label, index) => (
        <View
          key={label}
          style={styles.gap}
          {...(index === 0 ? {ref: topSectionRef} : {})}
          collapsable={false}
        >
          <Kb.Text type="BodyTiny">{label}</Kb.Text>
        </View>
      ))}
      {props.showNumSection &&
        ['0', '•', '9'].map(label => (
          <View key={label} style={styles.gap}>
            <Kb.Text type="BodyTiny">{label}</Kb.Text>
          </View>
        ))}
    </View>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    ...Kb.Styles.padding(2, 6, 2, 2),
    flexShrink: 1,
  },
}))

export default AlphabetIndex
