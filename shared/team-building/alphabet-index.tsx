import * as React from 'react'
import {NativeSyntheticEvent, NativeTouchEvent} from 'react-native'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {stubTrue} from 'lodash-es'

const initMeasureRef = {height: -1, pageY: -1}

type Props = {
  labels: Array<string>
  showNumSection: boolean
  onScroll: (label: string) => void
  style?: Styles.StylesCrossPlatform
}

const AlphabetIndex = (props: Props) => {
  const topSectionRef = React.useRef<Kb.Box>(null)
  const sectionMeasureRef = React.useRef<{height: number; pageY: number}>(initMeasureRef)
  const currIndex = React.useRef<number>(-1)

  // set sectionHeight
  React.useEffect(() => {
    if (topSectionRef && topSectionRef.current && Styles.isMobile) {
      const r = topSectionRef.current
      // @ts-ignore measure exists on mobile
      r.measure(
        (_, __, ___, height: number, ____, pageY: number) => (sectionMeasureRef.current = {height, pageY})
      )
    }
  })

  const {labels, onScroll} = props
  const handleTouch = React.useCallback(
    (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
      if (sectionMeasureRef.current) {
        const measure = sectionMeasureRef.current
        const touch = evt.nativeEvent.touches[0]
        const index = Math.floor((touch.pageY - measure.pageY) / measure.height)
        if (index >= 0 && index < labels.length && index !== currIndex.current) {
          currIndex.current = index
          onScroll(labels[index])
        }
      }
    },
    [labels, onScroll]
  )

  const clearTouch = React.useCallback(() => {
    sectionMeasureRef.current = initMeasureRef
  }, [])

  return (
    <Kb.Box
      style={Styles.collapseStyles([styles.container, props.style])}
      onStartShouldSetResponder={stubTrue}
      onMoveShouldSetResponder={stubTrue}
      onResponderGrant={handleTouch}
      oonResponderMove={handleTouch}
      onResponderRelease={clearTouch}
    >
      {labels.map((label, index) => (
        <Kb.Box key={label} style={styles.gap} {...(index === 0 ? {ref: topSectionRef} : {})}>
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

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    ...Styles.padding(2, 6, 2, 2),
    flexShrink: 1,
  },
})

export default AlphabetIndex
