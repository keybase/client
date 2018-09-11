// @flow
import * as React from 'react'
import {globalStyles, globalColors, platformStyles} from '../styles'
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

const styleBase = platformStyles({
  common: {
    ...globalStyles.fontTerminal,
    alignItems: 'flex-start',
    backgroundColor: globalColors.lightGrey,
    borderRadius: 3,
    color: globalColors.black_75,
    fontSize: 13,
    padding: 10,
    textAlign: 'left',
  },
  isElectron: {
    border: `solid 1px ${globalColors.black_10}`,
    justifyContent: 'stretch',
    lineHeight: '17px',
    overflowX: 'hidden',
    overflowY: 'auto',
    resize: 'none',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
})

export default CopyableText
