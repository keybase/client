// @flow
import * as React from 'react'
import {globalStyles, globalColors, platformStyles, collapseStyles, type StylesCrossPlatform} from '../styles'

type Props = {
  value: string,
  style?: StylesCrossPlatform,
}

const CopyableText = ({value, style}: Props) => {
  return (
    <textarea
      style={collapseStyles([styleBase, style])}
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
  isElectron: {
    ...globalStyles.fontTerminal,
    alignItems: 'flex-start',
    backgroundColor: globalColors.lightGrey,
    border: `solid 1px ${globalColors.black_10}`,
    borderRadius: 3,
    color: globalColors.black_75,
    fontSize: 13,
    justifyContent: 'stretch',
    lineHeight: '17px',
    overflowX: 'hidden',
    overflowY: 'auto',
    padding: 10,
    resize: 'none',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
})

export default CopyableText
