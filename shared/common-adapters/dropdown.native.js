// @flow
import React, {Component} from 'react'
import {TouchableWithoutFeedback, Picker, Modal} from 'react-native'
import Platform, {OS} from '../constants/platform'
import {globalStyles, globalColors} from '../styles/style-guide'
import Text from './text'
import Box from './box'
import Icon from './icon'
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
  value: ?string
}

class Dropdown extends Component {
  state: State;
  showingPick: boolean;

  constructor (props: Props) {
    super(props)

    this.showingPick = !this.props.value

    this.state = {
      modalVisible: false,
      value: this._stateValue(this.props.value),
    }
  }

  _stateValue (value: ?string): string {
    return value || pickItemValue
  }

  componentWillReceiveProps (nextProps: Props) {
    this.setState({value: this._stateValue(nextProps.value)})
  }

  _selected () {
    // Didn't actually select anything
    if (this.state.value === pickItemValue) {
      this.props.onClick(null, -1)
    } else if (this.state.value === otherItemValue) {
      if (this.props.onOther) {
        this.props.onOther()
      } else {
        console.warn('otherValue selected, yet no onOther handler')
      }
    } else if (this.props.onClick) {
      this.props.onClick(this.state.value, (this.props.options || []).indexOf(this.state.value))
    }
  }

  _showModal (show: boolean) {
    this.setState({modalVisible: show})

    if (show) {
      this._ensureSelected()
    } else {
      this._selected()
    }
  }

  _ensureSelected () {
    if (!this.state.value && this.props.options && this.props.options.length) {
      this.setState({value: this.props.options[0]})
    }
  }

  _itemStyle (): Object {
    return this.props.type === 'Username' ? {color: globalColors.orange} : {}
  }

  _label (value: ?string): string {
    if (!value) {
      return ''
    }

    return {
      [otherItemValue]: this.props.type === 'Username' ? 'Someone else...' : 'Or something else',
      [pickItemValue]: 'Pick an option',
    }[value] || value
  }

  _renderLabelAndCaret (): Array<React$Element> {
    return [
      <Text key='text' type='Header' style={{...styleText, ...this._itemStyle()}}>{this._label(this.state.value)}</Text>,
      <Icon key='icon' type='fa-caret-down' style={styleIcon} />,
    ]
  }

  _renderPicker (style: Object, selectOnChange: boolean): React$Element {
    const pickItem = this.showingPick ? [{key: pickItemValue, value: pickItemValue, label: this._label(pickItemValue)}] : []
    const actualItems = (this.props.options || []).map(o => ({key: o, label: o, value: o}))
    const otherItem = this.props.onOther ? {key: otherItemValue, label: this._label(otherItemValue), value: otherItemValue} : []
    const items = pickItem.concat(actualItems).concat(otherItem)

    const onValueChange = value => {
      if (value === this.state.value) {
        return
      }

      this.setState({value})
      if (selectOnChange) {
        this._selected()
      }
    }

    return (
      <Picker style={style} selectedValue={this.state.value} onValueChange={onValueChange}>
        {items.map(i => <Picker.Item {...i} />)}
      </Picker>
    )
  }

  _renderAndroid (): React$Element {
    return (
      <Box style={{...styleContainer, ...this.props.style}}>
        {this._renderPicker(stylePickerAndroid, true)}
        {this._renderLabelAndCaret()}
      </Box>
    )
  }

  _renderIOS (): React$Element {
    return (
      <TouchableWithoutFeedback onPress={() => this._showModal(true)}>
        <Box style={{...styleContainer, ...this.props.style}}>
          <Modal animated transparent visible={this.state.modalVisible} onRequestClose={() => this._showModal(false)}>
            <Box style={stylePickerContainer}>
              <TouchableWithoutFeedback onPress={() => this._showModal(false)}>
                <Box style={{flex: 1}} />
              </TouchableWithoutFeedback>
              {this._renderPicker(stylePickerIOS, false)}
            </Box>
          </Modal>
          {this._renderLabelAndCaret()}
        </Box>
      </TouchableWithoutFeedback>
    )
  }

  render (): React$Element {
    return OS === Platform.OS_IOS ? this._renderIOS() : this._renderAndroid()
  }
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderRadius: 100,
  width: 329,
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
  width: 20,
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
