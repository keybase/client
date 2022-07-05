import logger from '../../logger'
import {
  Box,
  Icon,
  Text,
  NativeTouchableWithoutFeedback,
  NativePicker,
  NativeModal,
} from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../styles'
import {isIOS} from '../../constants/platform'
import {ConfiguredAccount} from '../../constants/types/config'

type Props = {
  type: 'Username'
  options: Array<ConfiguredAccount>
  onClick: (option: string, index: number) => void
  onPress?: void
  onOther?: () => void
  value?: string | null
  style?: Object
}

/*
 * A dropdown on iOS and Android.
 * The iOS version will show a modal with an inline picker, clicking in the modal selects the option.
 * The Android version uses the built in picker but invisibly so it can show its modal correctly.
 */

// sentry for the 'other' value
const otherItemValue = 'otherItemValue'
// sentry for the 'pick' value
const pickItemValue = 'pickItemValue'

type State = {
  modalVisible: boolean
  value: string | null
}

class Dropdown extends React.Component<Props, State> {
  state: State
  showingPick: boolean

  constructor(props: Props) {
    super(props)

    this.state = {modalVisible: false, value: props.value || pickItemValue}
    this.showingPick = !this.props.value
  }
  componentDidUpdate(prevProps: Props) {
    if (this.props.value !== prevProps.value) {
      this.setState({value: this.props.value || pickItemValue})
    }
  }

  _selected() {
    // Didn't actually select anything
    if (this.state.value === pickItemValue) {
      this.props.onClick('', -1)
    } else if (this.state.value === otherItemValue) {
      if (this.props.onOther) {
        this.props.onOther()
      } else {
        logger.warn('otherValue selected, yet no onOther handler')
      }
      this.setState({value: (this.props.options[0] || {username: ''}).username})
    } else if (this.props.onClick) {
      this.props.onClick(
        this.state.value || '',
        (this.props.options || []).findIndex(u => u.username === this.state.value)
      )
    }
  }

  _showModal(show: boolean) {
    this.setState({modalVisible: show})

    if (show) {
      this._ensureSelected()
    } else {
      this._selected()
    }
  }

  _ensureSelected() {
    if (!this.state.value && this.props.options && this.props.options.length) {
      this.setState({value: (this.props.options[0] || {username: ''}).username})
    }
  }

  _label(value: string | null): string {
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

  _renderLabelAndCaret() {
    return [
      <Text key="text" type="Header" style={styles.orangeText}>
        {this._label(this.state.value)}
      </Text>,
      <Icon key="icon" type="iconfont-caret-down" style={styles.icon} sizeType="Tiny" />,
    ]
  }

  _renderPicker(style: Object, selectOnChange: boolean) {
    const pickItem = this.showingPick
      ? [{key: pickItemValue, label: this._label(pickItemValue), value: pickItemValue}]
      : []

    const actualItems = (this.props.options || []).map(o => ({
      key: o.username,
      label: o.hasStoredSecret ? `${o.username} (Signed in)` : o.username,
      value: o.username,
    }))
    const otherItem = this.props.onOther
      ? {key: otherItemValue, label: this._label(otherItemValue), value: otherItemValue}
      : []
    const items = pickItem.concat(actualItems).concat(otherItem)

    const onValueChange = value => {
      if (value === this.state.value) {
        return
      }

      this.setState({value}, () => {
        if (selectOnChange) {
          this._selected()
        }
      })
    }

    return (
      <NativePicker
        style={style}
        selectedValue={this.state.value}
        onValueChange={onValueChange}
        itemStyle={styles.item}
      >
        {items.map(i => (
          <NativePicker.Item {...i} key={i.label} />
        ))}
      </NativePicker>
    )
  }

  _renderAndroid() {
    // MM: This is super tricky. _renderPicker is an invisible box that, when clicked, opens
    // the native picker. We need to make sure it's the last thing drawn so it lies on top of
    // everything else.
    // TODO: Clean this up to be less tricky
    return (
      <Box style={{...styles.container, ...this.props.style}}>
        {this._renderLabelAndCaret()}
        {this._renderPicker(styles.pickerAndroid, true)}
      </Box>
    )
  }

  _renderIOS() {
    return (
      <NativeTouchableWithoutFeedback onPress={() => this._showModal(true)}>
        <Box style={{...styles.container, ...this.props.style}}>
          <NativeModal
            animationType="slide"
            transparent={true}
            visible={this.state.modalVisible}
            onRequestClose={() => this._showModal(false)}
          >
            <Box style={styles.pickerContainer}>
              <NativeTouchableWithoutFeedback onPress={() => this._showModal(false)}>
                <Box style={{flex: 1}} />
              </NativeTouchableWithoutFeedback>
              {this._renderPicker(styles.pickerIOS, false)}
            </Box>
          </NativeModal>
          {this._renderLabelAndCaret()}
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }

  render() {
    return isIOS ? this._renderIOS() : this._renderAndroid()
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderWidth: 1,
        height: 48,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      icon: {width: 10},
      item: {color: Styles.globalColors.black},
      orangeText: {
        color: Styles.globalColors.orange,
        flex: 1,
        lineHeight: 28,
      },
      pickerAndroid: {
        backgroundColor: Styles.globalColors.transparent,
        bottom: 0,
        color: Styles.globalColors.transparent,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      pickerContainer: {
        backgroundColor: Styles.globalColors.black_50OrBlack_60,
        flex: 1,
        justifyContent: 'flex-end',
      },
      pickerIOS: {backgroundColor: Styles.globalColors.white},
    } as const)
)

export default Dropdown
