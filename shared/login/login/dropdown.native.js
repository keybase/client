// @flow
import logger from '../../logger'
import {
  Box,
  Icon,
  Text,
  NativeTouchableWithoutFeedback,
  NativePicker,
  NativeModal,
} from '../../common-adapters/index.native'
import * as React from 'react'
import {globalStyles, globalColors} from '../../styles'
import {isIOS} from '../../constants/platform'

type Props = {
  type: 'Username' | 'General',
  options: Array<string>,
  onClick: (option: string, index: number) => void,
  onPress?: void,
  onOther?: () => void,
  value?: ?string,
  style?: Object,
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
  modalVisible: boolean,
  value: ?string,
}

class Dropdown extends React.Component<Props, State> {
  state: State = {modalVisible: false, value: null}
  showingPick: boolean

  constructor(props: Props) {
    super(props)

    this.showingPick = !this.props.value
  }

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    return {value: nextProps.value || pickItemValue}
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
    } else if (this.props.onClick) {
      this.props.onClick(this.state.value || '', (this.props.options || []).indexOf(this.state.value || ''))
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
      this.setState({value: this.props.options[0]})
    }
  }

  _itemStyle(): Object {
    return this.props.type === 'Username' ? {color: globalColors.orange} : {}
  }

  _label(value: ?string): string {
    if (!value) {
      return ''
    }

    return (
      {
        [otherItemValue]: this.props.type === 'Username' ? 'Someone else...' : 'Or something else',
        [pickItemValue]: 'Pick an option',
      }[value] || value
    )
  }

  _renderLabelAndCaret(): Array<React.Node> {
    return [
      <Text key="text" type="Header" style={{...styleText, ...this._itemStyle()}}>
        {this._label(this.state.value)}
      </Text>,
      <Icon key="icon" type="iconfont-caret-down" style={styleIcon} />,
    ]
  }

  _renderPicker(style: Object, selectOnChange: boolean): React.Node {
    const pickItem = this.showingPick
      ? [{key: pickItemValue, value: pickItemValue, label: this._label(pickItemValue)}]
      : []
    const actualItems = (this.props.options || []).map(o => ({key: o, label: o, value: o}))
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
      <NativePicker style={style} selectedValue={this.state.value} onValueChange={onValueChange}>
        {items.map(i => <NativePicker.Item key={i.label} {...i} />)}
      </NativePicker>
    )
  }

  _renderAndroid(): React.Node {
    // MM: This is super tricky. _renderPicker is an invisible box that, when clicked, opens
    // the native picker. We need to make sure it's the last thing drawn so it lies on top of
    // everything else.
    // TODO: Clean this up to be less tricky
    return (
      <Box style={{...styleContainer, ...this.props.style}}>
        {this._renderLabelAndCaret()}
        {this._renderPicker(stylePickerAndroid, true)}
      </Box>
    )
  }

  _renderIOS(): React.Node {
    return (
      <NativeTouchableWithoutFeedback onPress={() => this._showModal(true)}>
        <Box style={{...styleContainer, ...this.props.style}}>
          <NativeModal
            animationType={'slide'}
            transparent={true}
            visible={this.state.modalVisible}
            onRequestClose={() => this._showModal(false)}
          >
            <Box style={stylePickerContainer}>
              <NativeTouchableWithoutFeedback onPress={() => this._showModal(false)}>
                <Box style={{flex: 1}} />
              </NativeTouchableWithoutFeedback>
              {this._renderPicker(stylePickerIOS, false)}
            </Box>
          </NativeModal>
          {this._renderLabelAndCaret()}
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }

  render(): React.Node {
    return isIOS ? this._renderIOS() : this._renderAndroid()
  }
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderRadius: 100,
  height: 40,
  paddingLeft: 17,
  paddingRight: 17,
  borderWidth: 1,
  borderColor: globalColors.black_10,
}

const styleText = {
  flex: 1,
  textAlign: 'center',
}

const styleIcon = {
  width: 10,
}

const stylePickerContainer = {
  flex: 1,
  justifyContent: 'flex-end',
  backgroundColor: globalColors.black_40,
}

const stylePickerIOS = {
  backgroundColor: globalColors.white,
}

const stylePickerAndroid = {
  backgroundColor: globalColors.transparent,
  color: globalColors.transparent,
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  right: 0,
}

export default Dropdown
