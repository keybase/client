// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'

type Props = {
  onChangeText: (newText: string) => void,
  onEnterKeyDown: (textOnEnter: string) => void,
  onDownArrowKeyDown: () => void,
  onUpArrowKeyDown: () => void,
  onBackspaceWhileEmpty: () => void,
}

const handleKeyDown = (e: {key: string, target: {value: string}}, props: Props) => {
  switch (e.key) {
    case 'ArrowDown':
      props.onDownArrowKeyDown()
      break
    case 'ArrowUp':
      props.onDownArrowKeyDown()
      break
    case 'Backspace':
      !e.target.value && props.onBackspaceWhileEmpty()
      break
  }
}

const Input = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    <Kb.Input
      hintText={'Find people by name, email, or phone'}
      onChangeText={props.onChangeText}
      onEnterKeyDown={e => props.onEnterKeyDown(e.target.value)}
      onKeyDown={e => handleKeyDown(e, props)}
      uncontrolled={true}
      small={true}
      hideUnderline={true}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
      flex: 1,
    },
  }),
})

export default Input
