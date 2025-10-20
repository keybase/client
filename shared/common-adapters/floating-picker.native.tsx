import * as React from 'react'
import * as Styles from '@/styles'
import SafeAreaView from './safe-area-view'
import {Picker} from '@react-native-picker/picker'
import {Box2} from './box'
import Overlay from './overlay'
import Text from './text'
import type {Props} from './floating-picker'

const Kb = {
  Box2,
  Overlay,
  Picker,
  SafeAreaView,
  Text,
}

// semi-controller to work around issues where a fully controlled one will cause the wheel on ios
// to jump back and then slowly animate to the value you just went to
function WrapPicker<T>(p: {
  initialValue?: T
  onValueChange: (v: T | undefined) => void
  prompt?: string
  style?: Styles.StylesCrossPlatform
  itemStyle?: Styles.StylesCrossPlatform
  options: Array<{label: string; value: T}>
}) {
  const {initialValue, onValueChange, options, prompt, style, itemStyle} = p
  const [localValue, setLocalValue] = React.useState(initialValue)

  const handleValueChange = React.useCallback(
    (value: T) => {
      const selectedOption = options.find(option => option.value === value)
      if (!selectedOption) return
      setLocalValue(selectedOption.value)
      onValueChange(selectedOption.value)
    },
    [onValueChange, options]
  )

  return (
    <Picker
      selectedValue={localValue}
      onValueChange={handleValueChange}
      prompt={prompt}
      style={style}
      itemStyle={itemStyle}
    >
      {options.map((option, index) => (
        <Picker.Item key={index} label={option.label} value={option.value} />
      ))}
    </Picker>
  )
}

export {Picker}

// NOTE: this doesn't seem to work well when debugging w/ chrome. aka if you scroll and set a value the native component will undo it a bunch and its very finnicky. works fine outside of that it seems
const FloatingPicker = <T extends string | number>(props: Props<T>) => {
  if (!props.visible) {
    return null
  }

  return (
    <Kb.Overlay
      key={
        // Android bug: after selecting a new value (e.g. in
        // set-explode-popup), it flips to the new value, then back to the old
        // value, then to the new value. There is also a user report claiming
        // it flips forever. So just force remounting when the selected avlue
        // changes as a hacky fix.
        Styles.isAndroid ? props.selectedValue || 0 : undefined
      }
      onHidden={props.onHidden}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.menu}>
        {props.header}
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.actionButtons}>
          <Kb.Text type="BodySemibold" style={styles.link} onClick={props.onCancel}>
            Cancel
          </Kb.Text>
          <Kb.Box2 direction="horizontal" style={styles.flexOne} />
          <Kb.Text type="BodySemibold" style={styles.link} onClick={props.onDone}>
            Done
          </Kb.Text>
        </Kb.Box2>
        {props.prompt}
        <WrapPicker<T>
          initialValue={props.selectedValue}
          onValueChange={props.onSelect}
          prompt={props.promptString}
          style={styles.picker}
          itemStyle={styles.item}
          options={props.items}
        />
        <Kb.SafeAreaView style={styles.safeArea} />
      </Kb.Box2>
    </Kb.Overlay>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionButtons: {
        alignItems: 'stretch',
        height: 56,
        justifyContent: 'flex-end',
      },
      flexOne: {
        flex: 1,
      },
      item: {
        ...Styles.globalStyles.fontRegular,
        color: Styles.globalColors.black,
      },
      link: {
        color: Styles.globalColors.blueDark,
        fontSize: 17,
        padding: Styles.globalMargins.small,
      },
      menu: {
        alignItems: 'stretch',
        backgroundColor: Styles.globalColors.white,
        justifyContent: 'flex-end',
      },
      overlay: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        backgroundColor: Styles.globalColors.black_50,
        justifyContent: 'flex-end',
      },
      overlayContainer: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      picker: Styles.platformStyles({
        isAndroid: {
          color: Styles.globalColors.black,
          marginBottom: Styles.globalMargins.large,
          marginTop: Styles.globalMargins.medium,
        },
      }),
      safeArea: {
        backgroundColor: Styles.globalColors.white,
      },
    }) as const
)

export default FloatingPicker
