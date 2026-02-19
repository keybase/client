import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {Picker} from '@react-native-picker/picker'
import {View, TouchableWithoutFeedback, Modal} from 'react-native'

/*
 * A dropdown on iOS and Android.
 * The iOS version will show a modal with an inline picker, clicking in the modal selects the option.
 * The Android version uses the built in picker but invisibly so it can show its modal correctly.
 */

type Props = {
  type: 'Username'
  options: Array<T.Config.ConfiguredAccount>
  onClick: (option: string) => void
  onOther: () => void
  value: string
}

const otherItemValue = 'otherItemValue'
const pickItemValue = 'pickItemValue'

const label = (value: string): string => {
  if (!value) {
    return ''
  }
  return (
    {
      [otherItemValue]: 'Someone else...',
      [pickItemValue]: 'Pick an option',
    }[value] || value
  )
}

const Dropdown = (props: Props) => {
  const {value: _value, onOther, onClick} = props
  const [modalVisible, setModalVisible] = React.useState(false)
  const [value, setValue] = React.useState(_value || pickItemValue)
  const showingPick = !value

  const selected = React.useCallback(
    (v: string) => {
      if (v === _value) return
      if (v === otherItemValue) {
        onOther()
      } else {
        onClick(v)
      }
    },
    [onOther, onClick, _value]
  )

  const showModal = (show: boolean) => {
    setModalVisible(show)
    if (!show) {
      selected(value)
    }
  }

  const labelAndCaret = (
    <>
      <Kb.Text3 key="text" type="Header" style={styles.orangeText}>
        {label(value)}
      </Kb.Text3>
      {Kb.Styles.isAndroid ? null : (
        <Kb.Icon key="icon" type="iconfont-caret-down" style={styles.icon} sizeType="Tiny" />
      )}
    </>
  )

  const pickItem = showingPick
    ? [{key: pickItemValue, label: label(pickItemValue), value: pickItemValue}]
    : []

  const actualItems = props.options.map(o => ({
    key: o.username,
    label: o.hasStoredSecret ? `${o.username} (Signed in)` : o.username,
    value: o.username,
  }))
  const otherItem = {key: otherItemValue, label: label(otherItemValue), value: otherItemValue}
  const items = pickItem.concat(actualItems).concat(otherItem)

  // on android we immediately choose, on ios you have to close the modal to choose
  React.useEffect(() => {
    if (Kb.Styles.isAndroid) {
      selected(value)
    }
  }, [value, selected])

  const picker = (
    <Picker style={styles.picker} selectedValue={value} onValueChange={setValue} itemStyle={styles.item}>
      {items.map(i => (
        <Picker.Item {...i} key={i.label} />
      ))}
    </Picker>
  )

  if (Kb.Styles.isIOS) {
    return (
      <TouchableWithoutFeedback onPress={() => showModal(true)}>
        <View style={styles.container}>
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => showModal(false)}
          >
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.pickerContainer}>
              <TouchableWithoutFeedback onPress={() => showModal(false)}>
                <View style={{flex: 1}} />
              </TouchableWithoutFeedback>
              {picker}
            </Kb.Box2>
          </Modal>
          {labelAndCaret}
        </View>
      </TouchableWithoutFeedback>
    )
  } else {
    return (
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.container}>
        {labelAndCaret}
        {picker}
      </Kb.Box2>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.white,
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderWidth: 1,
        height: 48,
        maxWidth: '100%',
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      icon: {width: 10},
      item: {color: Kb.Styles.globalColors.black},
      orangeText: {
        color: Kb.Styles.globalColors.orange,
        flex: 1,
        lineHeight: 28,
      },
      picker: Kb.Styles.platformStyles({
        isAndroid: {
          backgroundColor: Kb.Styles.globalColors.transparent,
          bottom: 0,
          color: Kb.Styles.globalColors.transparent,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
        isIOS: {backgroundColor: Kb.Styles.globalColors.white},
      }),
      pickerContainer: {
        backgroundColor: Kb.Styles.globalColors.black_50OrBlack_60,
        flex: 1,
        justifyContent: 'flex-end',
      },
    }) as const
)

export default Dropdown
