import * as Kb from '@/common-adapters'
import type {TextType, StylesTextCrossPlatform} from '@/common-adapters/text.shared'

export type Props = {
  name: string
  elementStyle?: StylesTextCrossPlatform | undefined
  type: TextType
  selectable?: boolean | undefined
  center?: boolean | undefined
}

// We are splitting on ',' here, so it won't work for
// long names that don't have comma. If this becomes a
// problem, we might have to do smarter splitting that
// involve other characters, or just break the long name
// apart into 3-character groups.
const CommaSeparatedName = (props: Props) => (
  <>
    {props.name.split(',').map<React.ReactElement>((elem, idx, {length}: Array<string>) => (
      <Kb.Text
        {...(props.selectable === undefined ? {} : {selectable: props.selectable})}
        {...(props.center === undefined ? {} : {center: props.center})}
        key={idx.toString()}
        type={props.type}
        {...(props.elementStyle === undefined ? {} : {style: props.elementStyle})}
      >
        {elem}
        {idx !== length - 1 ? ',' : ''}
      </Kb.Text>
    ))}
  </>
)
export default CommaSeparatedName
