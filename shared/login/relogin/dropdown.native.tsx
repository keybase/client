import logger from '@/logger'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {Picker} from '@react-native-picker/picker'
import {TouchableWithoutFeedback, Modal} from 'react-native'

type Props = {
  type: 'Username'
  options: Array<T.Config.ConfiguredAccount>
  onClick: (option: string, index: number) => void
  onPress?: () => void
  onOther?: () => void
  value?: string
  style?: object
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
  value: string
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
    } else {
      this.props.onClick(
        this.state.value || '',
        this.props.options.findIndex(u => u.username === this.state.value)
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
    if (!this.state.value && this.props.options.length) {
      this.setState({value: (this.props.options[0] || {username: ''}).username})
    }
  }

  _label(value: string): string {
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
    return (
      <>
        <Kb.Text key="text" type="Header" style={styles.orangeText}>
          {this._label(this.state.value)}
        </Kb.Text>
        {Kb.Styles.isAndroid ? null : (
          <Kb.Icon key="icon" type="iconfont-caret-down" style={styles.icon} sizeType="Tiny" />
        )}
      </>
    )
  }

  _renderPicker(style: object, selectOnChange: boolean) {
    const pickItem = this.showingPick
      ? [{key: pickItemValue, label: this._label(pickItemValue), value: pickItemValue}]
      : []

    const actualItems = this.props.options.map(o => ({
      key: o.username,
      label: o.hasStoredSecret ? `${o.username} (Signed in)` : o.username,
      value: o.username,
    }))
    const otherItem = this.props.onOther
      ? {key: otherItemValue, label: this._label(otherItemValue), value: otherItemValue}
      : []
    const items = pickItem.concat(actualItems).concat(otherItem)

    const onValueChange = (value: string) => {
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
      <Picker
        style={style}
        selectedValue={this.state.value}
        onValueChange={onValueChange}
        itemStyle={styles.item}
      >
        {items.map(i => (
          <Picker.Item {...i} key={i.label} />
        ))}
      </Picker>
    )
  }

  _renderAndroid() {
    // MM: This is super tricky. _renderPicker is an invisible box that, when clicked, opens
    // the native picker. We need to make sure it's the last thing drawn so it lies on top of
    // everything else.
    // TODO: Clean this up to be less tricky
    return (
      <Kb.Box style={{...styles.container, ...this.props.style}}>
        {this._renderLabelAndCaret()}
        {this._renderPicker(styles.pickerAndroid, true)}
      </Kb.Box>
    )
  }

  _renderIOS() {
    return (
      <TouchableWithoutFeedback onPress={() => this._showModal(true)}>
        <Kb.Box style={{...styles.container, ...this.props.style}}>
          <Modal
            animationType="slide"
            transparent={true}
            visible={this.state.modalVisible}
            onRequestClose={() => this._showModal(false)}
          >
            <Kb.Box style={styles.pickerContainer}>
              <TouchableWithoutFeedback onPress={() => this._showModal(false)}>
                <Kb.Box style={{flex: 1}} />
              </TouchableWithoutFeedback>
              {this._renderPicker(styles.pickerIOS, false)}
            </Kb.Box>
          </Modal>
          {this._renderLabelAndCaret()}
        </Kb.Box>
      </TouchableWithoutFeedback>
    )
  }

  render() {
    return Kb.Styles.isIOS ? this._renderIOS() : this._renderAndroid()
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
