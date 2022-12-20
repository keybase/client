import * as React from 'react'
import type {NativeSyntheticEvent, NativeTouchEvent} from 'react-native'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

const stubTrue = () => true
const initMeasureRef = {height: -1, pageY: -1}
const isValidMeasure = (m: typeof initMeasureRef) => m.height >= 0 && m.pageY >= 0
const updateMeasure = (m: typeof initMeasureRef, newM: typeof initMeasureRef) =>
  isValidMeasure(newM) ? newM : m

type Props = {
  labels: Array<string>
  showNumSection: boolean
  measureKey?: any // change this when the position of AlphabetIndex on the screen changes
  onScroll: (label: string) => void
  style?: Styles.StylesCrossPlatform
}

const AlphabetIndex = (props: Props) => {
  const topSectionRef = React.useRef<Kb.Box>(null)
  const sectionMeasureRef = React.useRef<{height: number; pageY: number}>(initMeasureRef)
  const currIndex = React.useRef<number>(-1)

  // This timeout is long because our ref is set before the screen transition
  // finishes. Transition must be finished so we get accurate coords.
  const storeMeasure = Kb.useTimeout(() => {
    if (topSectionRef.current && Styles.isMobile) {
      // @ts-ignore measure exists on mobile
      topSectionRef.current.measure(
        (_1: unknown, _2: unknown, _3: unknown, height: number, _4: unknown, pageY: number) => {
          sectionMeasureRef.current = updateMeasure(sectionMeasureRef.current, {height, pageY})
        }
      )
    }
  }, 200)
  // eslint-disable-next-line
  React.useEffect(storeMeasure, [props.measureKey])

  const {labels, onScroll, showNumSection} = props
  const handleTouch = React.useCallback(
    (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
      if (sectionMeasureRef.current && isValidMeasure(sectionMeasureRef.current)) {
        const measure = sectionMeasureRef.current
        const touch = evt.nativeEvent.touches[0]
        const index = Math.floor((touch.pageY - measure.pageY) / measure.height)
        if (index >= 0 && index < labels.length && index !== currIndex.current) {
          currIndex.current = index
          onScroll(labels[index])
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
    <Kb.Box
      style={Styles.collapseStyles([styles.container, props.style])}
      onStartShouldSetResponder={stubTrue}
      onMoveShouldSetResponder={stubTrue}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={clearTouch}
    >
      {/* It's assumed that every row is the same height */}
      {labels.map((label, index) => (
        <Kb.Box
          key={label}
          style={styles.gap}
          {...(index === 0 ? {ref: topSectionRef} : {})}
          collapsable={false}
        >
          <Kb.Text type="BodyTiny">{label}</Kb.Text>
        </Kb.Box>
      ))}
      {props.showNumSection &&
        ['0', '•', '9'].map(label => (
          <Kb.Box key={label} style={styles.gap}>
            <Kb.Text type="BodyTiny">{label}</Kb.Text>
          </Kb.Box>
        ))}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    ...Styles.padding(2, 6, 2, 2),
    flexShrink: 1,
  },
}))

export default AlphabetIndex
