import * as Styles from '../styles'
import type {Props} from './copyable-text'

const CopyableText = ({value, style}: Props) => {
  return (
    <textarea
      style={Styles.collapseStyles([styles.base, style])}
      readOnly={true}
      value={value}
      onClick={e => {
        const target = e.target as HTMLTextAreaElement
        target.focus()
        target.select()
      }}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      base: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.fontTerminal,
          alignItems: 'flex-start',
          backgroundColor: Styles.globalColors.greyLight,
          borderRadius: 3,
          color: Styles.globalColors.black,
          fontSize: 13,
          padding: 10,
          textAlign: 'left',
        },
        isElectron: {
          border: `solid 1px ${Styles.globalColors.black_10}`,
          justifyContent: 'stretch',
          lineHeight: '17px',
          overflowX: 'hidden',
          overflowY: 'auto',
          resize: 'none',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        },
      }),
    } as const)
)

export default CopyableText
