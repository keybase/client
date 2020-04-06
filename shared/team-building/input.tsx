import * as React from 'react'
import noop from 'lodash/noop'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import * as Container from '../util/container'

type Props = {
  onChangeText: (newText: string) => void
  onClear: () => void
  onEnterKeyDown: () => void
  onDownArrowKeyDown: () => void
  onUpArrowKeyDown: () => void
  placeholder: string
  searchString: string
  focusOnMount: boolean
  focusCounter: number
}

const handleKeyDown = (preventDefault: () => void, ctrlKey: boolean, key: string, props: Props) => {
  switch (key) {
    case 'p':
      if (ctrlKey) {
        preventDefault()
        props.onUpArrowKeyDown()
      }
      break
    case 'n':
      if (ctrlKey) {
        preventDefault()
        props.onDownArrowKeyDown()
      }
      break
    case 'Tab':
    case ',':
      preventDefault()
      props.onEnterKeyDown()
      break
    case 'ArrowDown':
      preventDefault()
      props.onDownArrowKeyDown()
      break
    case 'ArrowUp':
      preventDefault()
      props.onUpArrowKeyDown()
      break
  }
}

const Input = (props: Props) => {
  const ref = React.useRef<Kb.SearchFilter>(null)
  const {focusCounter} = props
  const prevFocusCounter = Container.usePrevious(focusCounter)
  React.useEffect(() => {
    if (
      !Styles.isMobile &&
      prevFocusCounter !== undefined &&
      focusCounter > prevFocusCounter &&
      ref.current
    ) {
      ref.current.focus()
    }
  }, [focusCounter, prevFocusCounter])
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.SearchFilter
        size="full-width"
        valueControlled={true}
        value={props.searchString}
        icon="iconfont-search"
        focusOnMount={props.focusOnMount}
        onChange={props.onChangeText}
        onCancel={props.onClear}
        placeholderText={props.placeholder}
        onKeyDown={e => {
          handleKeyDown(() => e.preventDefault(), e.ctrlKey, e.key, props)
        }}
        onKeyPress={e => {
          handleKeyDown(noop, false, e.nativeEvent.key, props)
        }}
        onEnterKeyDown={props.onEnterKeyDown}
        ref={ref}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
    },
    isMobile: {
      justifyContent: 'flex-start',
      zIndex: -1, // behind ServiceTabBar
    },
  }),
}))

export default Input
