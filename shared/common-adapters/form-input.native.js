// @flow
import * as React from 'react'
import Box from './box'
import {NativeTextInput, NativeStyleSheet} from './native-wrappers.native'
import {backgroundModeToColor, globalColors, globalMargins, globalStyles} from '../styles'
import Text, {getStyle} from './text'
import type {TextType, Background} from './text'

export type Props = {
  autoCorrect?: boolean,
  autoFocus?: boolean,
  backgroundMode?: Background,
  containerStyle?: any,
  inputStyle?: any,
  label?: string,
  onEnterKeyDown?: ?() => void,
  value?: string,
  textType?: TextType,
  secure?: boolean,
  maxHeight?: number,
  multiline?: boolean,
  hideBottomBorder?: boolean,
  hideTopBorder?: boolean,
  onChangeText?: (value: string) => void,
}

type State = {
  focused: boolean,
}

class FormInput extends React.Component<Props, State> {
  static defaultProps: Props = {
    value: '',
  }
  state: State = {
    focused: false,
  }

  _input: any

  setValue = (value: string) => {
    this._onChangeText(value)
  }

  clearValue = () => {
    this._onChangeText('')
  }

  focus = () => {
    this._input && this._input.focus()
  }

  blur = () => {
    this._input && this._input.blur()
  }

  select = () => {
    this._input && this._input.select()
  }

  _onChangeText = (text: string) => {
    this.props.onChangeText && this.props.onChangeText(text)
  }

  _onFocus = () => {
    this.setState({
      focused: true,
    })
  }

  _onBlur = () => {
    this.setState({
      focused: false,
    })
  }

  _onKeyPress = (e: SyntheticKeyboardEvent<>) => {
    if (this.props.onEnterKeyDown && e.key === 'Enter') {
      this.props.onEnterKeyDown()
    }
  }

  render() {
    const backgroundColor = this.props.backgroundMode
      ? backgroundModeToColor[this.props.backgroundMode]
      : globalColors.white

    return (
      <Box
        style={[
          containerStyle.common,
          this.props.hideTopBorder && containerStyle.hideTopBorder,
          this.props.hideBottomBorder && containerStyle.hideBottomBorder,
          this.props.multiline && containerStyle.multiline,
          this.props.maxHeight && {maxHeight: this.props.maxHeight},
          this.props.containerStyle,
        ]}
      >
        {(!!this.props.value || this.state.focused) && (
          <Text type="BodySmallSemibold" style={smallLabelStyle}>
            {this.props.label}
          </Text>
        )}
        {!!this.props.label && this.props.multiline && <Box style={{...headerBlockStyle, backgroundColor}} />}
        <NativeTextInput
          autoCorrect={this.props.autoCorrect}
          autoFocus={this.props.autoFocus}
          autoGrow={!!this.props.multiline && !!this.props.maxHeight}
          value={this.props.value}
          onChangeText={this._onChangeText}
          placeholder={this.state.focused ? '' : this.props.label}
          ref={input => (this._input = input)}
          onFocus={this._onFocus}
          onBlur={this._onBlur}
          onKeyPress={this._onKeyPress}
          onSubmitEditing={this.props.onEnterKeyDown}
          secureTextEntry={this.props.secure}
          multiline={this.props.multiline}
          style={[
            inputStyle.common,
            (this.props.value || this.state.focused) && inputStyle.paddingTop,
            this.props.textType && getStyle(this.props.textType, this.props.backgroundMode),
            !this.props.textType && getStyle('BodySemibold', this.props.backgroundMode),
            this.props.inputStyle,
          ]}
        />
      </Box>
    )
  }
}

const containerStyle = NativeStyleSheet.create({
  common: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: globalColors.black_10,
    borderTopWidth: 1,
    minHeight: 64,
    position: 'relative',
    width: '100%',
  },
  hideBottomBorder: {
    borderBottomWidth: 0,
  },
  hideTopBorder: {
    borderTopWidth: 0,
  },
  multiline: {
    minHeight: 128,
  },
})

const smallLabelStyle = {
  backgroundColor: globalColors.transparent,
  color: globalColors.blue,
  fontSize: 11,
  left: globalMargins.small,
  position: 'absolute',
  top: globalMargins.tiny,
  zIndex: 2,
}

const headerBlockStyle = {
  height: 22,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 1,
}

const inputStyle = NativeStyleSheet.create({
  common: {
    flexBasis: 'auto',
    marginBottom: 18,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: 21,
    width: '100%',
  },
  largePaddingTop: {
    paddingTop: 24,
  },
})

export {FormInput}
