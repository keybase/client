// @flow
import React from 'react'
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

const handleKeyDown = (e: any, key: string, props: Props) => {
  switch (key) {
    case 'p':
      if (e.ctrlKey) {
        e.preventDefault()
        props.onUpArrowKeyDown()
      }
      break
    case 'n':
      if (e.ctrlKey) {
        e.preventDefault()
        props.onDownArrowKeyDown()
      }
      break
    case 'ArrowDown':
      e.preventDefault()
      props.onDownArrowKeyDown()
      break
    case 'ArrowUp':
      e.preventDefault()
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
        handleKeyDown(e, e.key, props)
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
