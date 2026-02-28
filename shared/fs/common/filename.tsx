import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type {TextType} from '@/common-adapters/text.shared'

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
  // also does this to subteams...
  const [fileNameWithoutExtension, fileExtension] = splitFileNameAndExtension(
    props.path ? T.FS.getPathName(props.path) : props.filename || ''
  )
  return (
    <Kb.Box2 direction="horizontal" style={props.style}>
      <Kb.Text2
        className="hover-underline-child"
        type={props.type}
        style={styles.breakAll}
        lineClamp={1}
        selectable={props.selectable}
      >
        {fileNameWithoutExtension}
      </Kb.Text2>
      {fileExtension ? (
        <Kb.Text2
          className="hover-underline-child"
          type={props.type}
          style={styles.noShrink}
          selectable={props.selectable}
        >
          {fileExtension}
        </Kb.Text2>
      ) : null}
    </Kb.Box2>
  )
}

export default Filename

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      breakAll: Kb.Styles.platformStyles({
        common: {flexShrink: 1},
        isElectron: {wordBreak: 'break-all'},
      }),
      noShrink: {flexShrink: 0},
    }) as const
)
