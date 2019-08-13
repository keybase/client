import * as React from 'react'
import {noop} from 'lodash-es'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'

type Props = {
  onChangeText: (newText: string) => void
  onClear: () => void
  onEnterKeyDown: () => void
  onDownArrowKeyDown: () => void
  onUpArrowKeyDown: () => void
  onBackspace: () => void
  placeholder: string
  searchString: string
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
    case 'Backspace':
      props.onBackspace()
      break
  }
}

const Input = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.SearchFilter
        value={props.searchString}
        icon="iconfont-search"
        focusOnMount={true}
        fullWidth={true}
        onChange={props.onChangeText}
        placeholderText={props.placeholder}
        onKeyDown={e => {
          handleKeyDown(() => e.preventDefault(), e.ctrlKey, e.key, props)
        }}
        onKeyPress={e => {
          handleKeyDown(noop, false, e.nativeEvent.key, props)
        }}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
    },
  }),
})

export default Input
