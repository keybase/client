// @flow
import React from 'react'
import {globalStyles, globalColors} from '../styles'
import type {Props} from './copyable-text'

const CopyableText = ({value, style}: Props) => {
  return (
    <textarea
      style={{...styleBase, ...style}}
      readOnly={true}
      value={value}
      onClick={e => {
        e.target.focus()
        e.target.select()
      }}
    />
  )
}

const styleBase = {
  ...globalStyles.fontTerminal,
  padding: 10,
  justifyContent: 'stretch',
  alignItems: 'flex-start',
  backgroundColor: globalColors.lightGrey,
  border: `solid 1px ${globalColors.black_10}`,
  borderRadius: 3,
  fontSize: 13,
  lineHeight: '17px',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowY: 'auto',
  overflowX: 'hidden',
  textAlign: 'left',
  resize: 'none',
  color: globalColors.black_75,
}

export default CopyableText
