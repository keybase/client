import * as React from 'react'
import noop from 'lodash/noop'
import * as Kb from '@/common-adapters/index'
import type {NativeSyntheticEvent} from 'react-native'

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

const handleKeyDown = (
  preventDefault: () => void,
  ctrlKey: boolean,
  key: string,
  onUpArrowKeyDown: () => void,
  onDownArrowKeyDown: () => void,
  onEnterKeyDown: () => void
) => {
  switch (key) {
    case 'p':
      if (ctrlKey) {
        preventDefault()
        onUpArrowKeyDown()
      }
      break
    case 'n':
      if (ctrlKey) {
        preventDefault()
        onDownArrowKeyDown()
      }
      break
    case 'Tab':
    case ',':
      preventDefault()
      onEnterKeyDown()
      break
    case 'ArrowDown':
      preventDefault()
      onDownArrowKeyDown()
      break
    case 'ArrowUp':
      preventDefault()
      onUpArrowKeyDown()
      break
  }
}

const Input = (props: Props) => {
  const ref = React.useRef<Kb.SearchFilterRef>(null)
  const {focusCounter, onUpArrowKeyDown, onDownArrowKeyDown, onEnterKeyDown} = props
  const prevFocusCounterRef = React.useRef(focusCounter)
  React.useEffect(() => {
    if (!Kb.Styles.isMobile && focusCounter > prevFocusCounterRef.current && ref.current) {
      ref.current.focus()
    }
    prevFocusCounterRef.current = focusCounter
  }, [focusCounter, prevFocusCounterRef])

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(
        () => e.preventDefault(),
        e.ctrlKey,
        e.key,
        onUpArrowKeyDown,
        onDownArrowKeyDown,
        onEnterKeyDown
      )
    },
    [onUpArrowKeyDown, onDownArrowKeyDown, onEnterKeyDown]
  )

  const onKeyPress = React.useCallback(
    (e: NativeSyntheticEvent<{key: string}>) => {
      handleKeyDown(noop, false, e.nativeEvent.key, onUpArrowKeyDown, onDownArrowKeyDown, onEnterKeyDown)
    },
    [onUpArrowKeyDown, onDownArrowKeyDown, onEnterKeyDown]
  )

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
        onKeyDown={onKeyDown}
        onKeyPress={onKeyPress}
        onEnterKeyDown={props.onEnterKeyDown}
        ref={ref}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
    },
    isMobile: {
      justifyContent: 'flex-start',
      zIndex: -1, // behind ServiceTabBar
    },
  }),
}))

export default Input
