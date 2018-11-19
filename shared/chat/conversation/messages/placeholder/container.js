// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Placeholder from '.'

const Wrapper = (props: {message: Types.Message}) => <Placeholder ordinal={props.message.ordinal} />
export default Wrapper
