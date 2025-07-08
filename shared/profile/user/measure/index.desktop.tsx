import * as React from 'react'
import * as Kb from '@/common-adapters'
import Rm, {type ContentRect} from 'react-measure'
import type {Props} from '.'

const Measure = (props: Props) => {
  const {onMeasured} = props
  const widthRef = React.useRef(0)

  const onResize = React.useCallback(
    (contentRect: ContentRect) => {
      if (contentRect.bounds === undefined) return
      if (widthRef.current !== contentRect.bounds.width) {
        widthRef.current = contentRect.bounds.width
        onMeasured(contentRect.bounds.width)
      }
    },
    [onMeasured]
  )

  return (
    <Rm bounds={true} onResize={onResize}>
      {({measureRef}: {measureRef: (ref: Element | null) => void}) => (
        <div ref={measureRef} style={styles.container} />
      )}
    </Rm>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {width: '100%'},
}))

export default Measure
