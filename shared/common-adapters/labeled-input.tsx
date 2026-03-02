import type * as React from 'react'
import Input3, {type Input3Props, type Input3Ref} from './input3'
import type * as Styles from '@/styles'

export type _Props = {
  containerStyle?: Styles.StylesCrossPlatform
  decoration?: React.ReactNode
  error?: boolean
  hoverPlaceholder?: string
  placeholder: string
  placeholderInline?: boolean
}

type PasswordProps = {type?: 'password' | 'text' | 'passwordVisible'}
export type Props = Input3Props & _Props & PasswordProps

function LabeledInput(props: Props & {ref?: React.Ref<Input3Ref>}) {
  const {containerStyle, decoration, error, hoverPlaceholder: _, placeholder, placeholderInline: _pi} = props
  const {type, ref, ...rest} = props
  const secureTextEntry = type === 'password' ? true : props.secureTextEntry

  return (
    <Input3
      {...rest}
      containerStyle={containerStyle}
      decoration={decoration}
      error={error}
      placeholder={placeholder}
      ref={ref}
      secureTextEntry={secureTextEntry}
    />
  )
}

export default LabeledInput
