// @flow
import Box from './box'
import Icon from './icon'
import React, {Component} from 'react'
import Text from './text'
import {NativeTouchableWithoutFeedback, NativePicker, NativeModal} from './native-wrappers.native'
import {globalStyles, globalColors} from '../styles'
import {isIOS} from '../constants/platform'

import type {Props} from './dropdown'

/*
 * A dropdown on ios and android.
 * The ios version will show a modal with an inline picker, clicking in the modal selects the option.
 * The android version uses the built in picker but invisibly so it can show its modal correctly.
 */

// sentry for the 'other' value
const otherItemValue = 'otherItemValue'
// sentry for the 'pick' value
const pickItemValue = 'pickItemValue'

type State = {
  modalVisible: boolean,
  value: ?string,
}

class Dropdown extends Component<void, Props, State> {
  state: State
  showingPick: boolean

  constructor(props: Props) {
    super(props)

    this.showingPick = !this.props.value

    this.state = {
      modalVisible: false,
      value: this._stateValue(this.props.value),
    }
  }

  _stateValue(value: ?string): string {
    return value || pickItemValue
  }

  componentWillReceiveProps(nextProps: Props) {
    this.setState({value: this._stateValue(nextProps.value)})
  }

  _selected() {
    // Didn't actually select anything
    if (this.state.value === pickItemValue) {
      this.props.onClick('', -1)
    } else if (this.state.value === otherItemValue) {
      if (this.props.onOther) {
        this.props.onOther()
      } else {
        console.warn('otherValue selected, yet no onOther handler')
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

  _renderLabelAndCaret(): Array<React$Element<*>> {
    return [
      <Text key="text" type="Header" style={{...styleText, ...this._itemStyle()}}>
        {this._label(this.state.value)}
      </Text>,
      <Icon key="icon" type="iconfont-caret-down" style={styleIcon} />,
    ]
  }

  _renderPicker(style: Object, selectOnChange: boolean): React$Element<*> {
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

  _renderAndroid(): React$Element<*> {
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

  _renderIOS(): React$Element<*> {
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

  render(): React$Element<*> {
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
