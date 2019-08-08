import * as React from 'react'
import {noop} from 'lodash-es'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {getStyle as getTextStyle} from '../common-adapters/text'
import {useFocus} from './hooks'

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
  const autofocus = true
  const [focused, onFocus, onBlur] = useFocus(autofocus)
  const visualFocused = focused || !!props.searchString
  return (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.container, visualFocused && styles.containerFocused])}
    >
      {!visualFocused && (
        <Kb.Icon
          color={Styles.globalColors.black_50}
          type="iconfont-search"
          fontSize={getTextStyle('BodySemibold').fontSize}
          style={styles.iconSearch}
        />
      )}
      <Kb.PlainInput
        autoFocus={autofocus}
        onFocus={onFocus}
        onBlur={onBlur}
        style={styles.input}
        placeholder={props.placeholder}
        placeholderColor={visualFocused ? Styles.globalColors.black_35 : Styles.globalColors.black_50}
        onChangeText={props.onChangeText}
        value={props.searchString}
        textType={visualFocused ? (Styles.isMobile ? 'BodySmall' : 'BodySmallSemibold') : 'BodySmallSemibold'}
        maxLength={50}
        onEnterKeyDown={props.onEnterKeyDown}
        onKeyDown={e => {
          handleKeyDown(() => e.preventDefault(), e.ctrlKey, e.key, props)
        }}
        onKeyPress={e => {
          handleKeyDown(noop, false, e.nativeEvent.key, props)
        }}
      />
      <Kb.Box2 direction="vertical" style={{marginLeft: 'auto'}}>
        {!!props.searchString && (
          <Kb.Icon
            color={Styles.globalColors.black_50}
            type="iconfont-remove"
            onClick={props.onClear}
            fontSize={getTextStyle('BodySemibold').fontSize}
            style={styles.iconX}
          />
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
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
  containerFocused: {
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
