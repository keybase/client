import * as React from 'react'
import * as Kb from '../../common-adapters'
import {InputStyle} from '../../common-adapters/plain-input'
import * as Styles from '../../styles'

const cleanChannelname = (name: string) => name.replace(/[^0-9a-zA-Z_-]/, '')

type ContentProps =
  | {isGeneral: true}
  | {
      isGeneral?: false
      onChange: (value: string) => void
      onClear?: () => void
      value: string
    }

type ChannelInputProps = {
  containerStyle?: Styles.StylesCrossPlatform
  disabled?: boolean
  style?: InputStyle
} & ContentProps

const ChannelInput = (props: ChannelInputProps) => {
  if (props.isGeneral) {
    return (
      <Kb.NewInput
        value="#general"
        disabled={true}
        containerStyle={styles.inputGeneral}
        style={props.style}
      />
    )
  }
  return (
    <Kb.NewInput
      value={props.value}
      onChangeText={text => props.onChange(cleanChannelname(text))}
      decoration={props.onClear ? <Kb.Icon type="iconfont-remove" onClick={props.onClear} /> : undefined}
      placeholder="channel"
      prefix="#"
      containerStyle={Styles.collapseStyles([styles.input, props.containerStyle])}
      style={props.style}
      maxLength={20}
      disabled={props.disabled}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
  inputGeneral: {...Styles.padding(Styles.globalMargins.xsmall), opacity: 0.4},
}))

export default ChannelInput
