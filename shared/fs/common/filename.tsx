import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as React from 'react'
import {allTextTypes} from '../../common-adapters/text.shared'

type TextType = keyof typeof allTextTypes

type Props = {
  path?: Types.Path
  filename?: string
  selectable?: boolean
  style?: Styles.StylesCrossPlatform
  type: TextType
}

const splitFileNameAndExtension = (fileName: string) => {
  const idx = fileName.lastIndexOf('.')
  if (idx === -1 || fileName.length - idx > 10) {
    return [fileName, '']
  } else {
    return [fileName.slice(0, idx), fileName.slice(idx)]
  }
}

const Filename = (props: Props) => {
  const [fileNameWithoutExtension, fileExtension] = splitFileNameAndExtension(
    props.path ? Types.getPathName(props.path) : props.filename || ''
  )
  return (
    <Kb.Box2 direction="horizontal" style={props.style}>
      <Kb.Text
        type={props.type}
        style={Styles.collapseStyles([props.style, styles.breakAll])}
        lineClamp={1}
        selectable={props.selectable}
      >
        {fileNameWithoutExtension}
      </Kb.Text>
      {!!fileExtension && (
        <Kb.Text
          type={props.type}
          style={Styles.collapseStyles([props.style, styles.noShrink])}
          selectable={props.selectable}
          lineClamp={0}
        >
          {fileExtension}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

export default Filename

const styles = Styles.styleSheetCreate({
  breakAll: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  noShrink: {
    flexShrink: 0,
  },
})
