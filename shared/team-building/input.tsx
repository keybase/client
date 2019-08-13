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
  const [color] = React.useState(`rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`)
  // const colorStyle = {backgroundColor: color}
  const colorStyle = {}
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.collapseStyles([colorStyle, styles.container])}>
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
  containerOld: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black_10,
    borderRadius: 4,
    flex: 1,
    margin: Styles.globalMargins.tiny,
    marginLeft: Styles.globalMargins.xsmall,
    marginRight: Styles.globalMargins.xsmall,
    minHeight: 32,
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xtiny),
  },
  containerOldFocused: {
    backgroundColor: Styles.globalColors.black_05,
  },
  iconSearch: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      marginRight: 0,
    },
    isMobile: {
      marginRight: Styles.globalMargins.xtiny,
    },
  }),
  iconX: {
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  input: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.transparent,
      marginLeft: Styles.globalMargins.xtiny,
    },
    isElectron: {
      height: 14,
    },
  }),
})

export default Input
