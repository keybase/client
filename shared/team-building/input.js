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
  clearTextTrigger: number,
}

const handleKeyDown = (e: any, key: string, props: Props) => {
  switch (key) {
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
    <Kb.Input
      hintText={'Find people by name, email, or phone'}
      onChangeText={props.onChangeText}
      onEnterKeyDown={e => {
        e.preventDefault()
        props.onEnterKeyDown()
      }}
      onKeyDown={e => {
        handleKeyDown(e, e.key, props)
      }}
      uncontrolled={true}
      clearTextCounter={props.clearTextTrigger}
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
