import * as T from '../../constants/types'
import * as Kb from '../../common-adapters'
import type {allTextTypes} from '../../common-adapters/text.shared'

type TextType = keyof typeof allTextTypes

type Props = {
  path?: T.FS.Path
  filename?: string
  selectable?: boolean
  style?: Kb.Styles.StylesCrossPlatform
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
    props.path ? T.FS.getPathName(props.path) : props.filename || ''
  )
  return (
    <Kb.Box2 direction="horizontal" style={props.style}>
      <Kb.Text
        fixOverdraw={true}
        className="hover-underline-child"
        type={props.type}
        style={Kb.Styles.collapseStyles([props.style, styles.breakAll])}
        lineClamp={1}
        selectable={props.selectable}
      >
        {fileNameWithoutExtension}
      </Kb.Text>
      {!!fileExtension && (
        <Kb.Text
          fixOverdraw={true}
          className="hover-underline-child"
          type={props.type}
          style={Kb.Styles.collapseStyles([props.style, styles.noShrink])}
          selectable={props.selectable}
        >
          {fileExtension}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

export default Filename

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      breakAll: Kb.Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-all',
        },
      }),
      noShrink: {
        flexShrink: 0,
      },
    }) as const
)
