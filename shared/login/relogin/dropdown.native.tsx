import logger from '@/logger'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {Picker} from '@react-native-picker/picker'
import {TouchableWithoutFeedback, Modal} from 'react-native'

/*
 * A dropdown on iOS and Android.
 * The iOS version will show a modal with an inline picker, clicking in the modal selects the option.
 * The Android version uses the built in picker but invisibly so it can show its modal correctly.
 */

type Props = {
  type: 'Username'
  options: Array<T.Config.ConfiguredAccount>
  onClick: (option: string, index: number) => void
  onPress?: () => void
  onOther?: () => void
  value?: string
  style?: object
}

const otherItemValue = 'otherItemValue'
const pickItemValue = 'pickItemValue'

const Dropdown = (props: Props) => {
  const {value: _value} = props
  const [modalVisible, setModalVisible] = React.useState(false)
  const [value, setValue] = React.useState(_value || pickItemValue)
  const showingPick = !_value

  const lastPropValue = React.useRef(_value)
  React.useEffect(() => {
    if (_value !== lastPropValue.current) {
      lastPropValue.current = _value
      setValue(_value || pickItemValue)
    }
  }, [_value, value])

  const selected = () => {
    if (value === pickItemValue) {
      props.onClick('', -1)
    } else if (value === otherItemValue) {
      if (props.onOther) {
        props.onOther()
      } else {
        logger.warn('otherValue selected, yet no onOther handler')
      }
      setValue((props.options[0] || {username: ''}).username)
    } else {
      props.onClick(
        value || '',
        props.options.findIndex(u => u.username === value)
      )
    }
  }

  const showModal = (show: boolean) => {
    setModalVisible(show)
    if (show) {
      ensureSelected()
    } else {
      selected()
    }
  }

  const ensureSelected = () => {
    if (!value && props.options.length) {
      setValue((props.options[0] || {username: ''}).username)
    }
  }

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

  const renderLabelAndCaret = () => (
    <>
      <Kb.Text key="text" type="Header" style={styles.orangeText}>
        {label(value)}
      </Kb.Text>
      {Kb.Styles.isAndroid ? null : (
        <Kb.Icon key="icon" type="iconfont-caret-down" style={styles.icon} sizeType="Tiny" />
      )}
    </>
  )

  const renderPicker = (style: object, selectOnChange: boolean) => {
    const pickItem = showingPick
      ? [{key: pickItemValue, label: label(pickItemValue), value: pickItemValue}]
      : []

    const actualItems = props.options.map(o => ({
      key: o.username,
      label: o.hasStoredSecret ? `${o.username} (Signed in)` : o.username,
      value: o.username,
    }))
    const otherItem = props.onOther
      ? {key: otherItemValue, label: label(otherItemValue), value: otherItemValue}
      : []
    const items = pickItem.concat(actualItems).concat(otherItem)

    const onValueChange = (v: string) => {
      if (v === value) {
        return
      }
      setValue(v)
      if (selectOnChange) {
        selected()
      }
    }

    return (
      <Picker style={style} selectedValue={value} onValueChange={onValueChange} itemStyle={styles.item}>
        {items.map(i => (
          <Picker.Item {...i} key={i.label} />
        ))}
      </Picker>
    )
  }

  const renderAndroid = () => (
    // MM: This is super tricky. _renderPicker is an invisible box that, when clicked, opens
    // the native picker. We need to make sure it's the last thing drawn so it lies on top of
    // everything else.
    // TODO: Clean this up to be less tricky
    <Kb.Box style={{...styles.container, ...props.style}}>
      {renderLabelAndCaret()}
      {renderPicker(styles.pickerAndroid, true)}
    </Kb.Box>
  )

  const renderIOS = () => (
    <TouchableWithoutFeedback onPress={() => showModal(true)}>
      <Kb.Box style={{...styles.container, ...props.style}}>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => showModal(false)}
        >
          <Kb.Box style={styles.pickerContainer}>
            <TouchableWithoutFeedback onPress={() => showModal(false)}>
              <Kb.Box style={{flex: 1}} />
            </TouchableWithoutFeedback>
            {renderPicker(styles.pickerIOS, false)}
          </Kb.Box>
        </Modal>
        {renderLabelAndCaret()}
      </Kb.Box>
    </TouchableWithoutFeedback>
  )

  return Kb.Styles.isIOS ? renderIOS() : renderAndroid()
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
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      icon: {width: 10},
      item: {color: Kb.Styles.globalColors.black},
      orangeText: {
        color: Kb.Styles.globalColors.orange,
        flex: 1,
        lineHeight: 28,
      },
      pickerAndroid: {
        backgroundColor: Kb.Styles.globalColors.transparent,
        bottom: 0,
        color: Kb.Styles.globalColors.transparent,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      pickerContainer: {
        backgroundColor: Kb.Styles.globalColors.black_50OrBlack_60,
        flex: 1,
        justifyContent: 'flex-end',
      },
      pickerIOS: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default Dropdown
