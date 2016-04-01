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

class Dropdown extends Component {
  state: {
    modalVisible: boolean,
    value: ?string
  };

  constructor (props: Props) {
    super(props)
    this.state = {
      modalVisible: false,
      value: this.props.value
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    this.setState({value: nextProps.value})
  }

  _selected () {
    if (!this.state.value && this.props.onOther) {
      this.props.onOther()
    } else if (this.props.onClick) {
      this.props.onClick(this.state.value, (this.props.options || []).indexOf(this.state.value))
    }
  }

  _showModal (show: boolean) {
    this.setState({modalVisible: show})

    if (show) {
      if (!this.state.value && this.props.options && this.props.options.length) {
        this.setState({value: this.props.options[0]})
      }
    } else {
      this._selected()
    }
  }

  _itemStyle (): Object {
    return this.props.type === 'Username' ? {color: globalColors.orange} : {}
  }

  _otherLabel (): string {
    return this.props.type === 'Username' ? 'Someone else...' : 'Or something else'
  }

  _renderLabelAndCaret (): Array<React$Element> {
    return [
      <Text key='text' type='Header' style={{...styleText, ...this._itemStyle()}}>{this.state.value || 'Pick an option'}</Text>,
      <Icon key='icon' type='fa-caret-down' style={styleIcon}/>
    ]
  }

  _renderPicker (style: Object, selectOnChange: boolean): React$Element {
    return (
      <Picker style={style}
        selectedValue={this.state.value}
        onValueChange={value => {
          this.setState({value})
          if (selectOnChange) {
            this._selected()
          }
        }} >
        {(this.props.options || []).map(o => (
          <Picker.Item key={o} label={o} value={o} />
        )).concat(this.props.onOther ? (
          <Picker.Item key='otherItemValue' label={this._otherLabel()} value='' />) : []
        )}
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
                <Box style={{flex: 1}}/>
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
  borderColor: globalColors.black10
}

const styleText = {
  flex: 1,
  textAlign: 'center'
}

const styleIcon = {
  width: 20
}

const stylePickerContainer = {
  flex: 1,
  justifyContent: 'flex-end',
  backgroundColor: globalColors.black40
}

const stylePickerIOS = {
  backgroundColor: globalColors.white
}

const stylePickerAndroid = {
  backgroundColor: globalColors.transparent,
  color: globalColors.transparent,
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  right: 0
}

export default Dropdown
