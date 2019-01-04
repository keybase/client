// @flow
import React from 'react'
import {noop} from 'lodash-es'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'

type Props = {
  onChangeText: (newText: string) => void,
  onEnterKeyDown: () => void,
  onDownArrowKeyDown: () => void,
  onUpArrowKeyDown: () => void,
  onBackspace: () => void,
  searchString: string,
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

const Input = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    <Kb.PlainInput
      autoFocus={true}
      globalCaptureKeypress={true}
      style={styles.input}
      placeholder={'Enter any username'}
      onChangeText={props.onChangeText}
      value={props.searchString}
      maxLength={50}
      onEnterKeyDown={props.onEnterKeyDown}
      onKeyDown={e => {
        handleKeyDown(() => e.preventDefault(), e.ctrlKey, e.key, props)
      }}
      onKeyPress={e => {
        handleKeyDown(noop, false, e.nativeEvent.key, props)
      }}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      flex: 1,
      marginLeft: Styles.globalMargins.xsmall,
    },
  }),
  input: Styles.platformStyles({
    common: {
      flex: 1,
    },
  }),
})

export default Input
