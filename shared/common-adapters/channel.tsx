import Text, {type StylesTextCrossPlatform} from './text'
import type {ConversationIDKey} from '../constants/types/chat2'

export type Props = {
  name: string
  convID: ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean | null
  onClick: () => void
}

export const Channel = ({name, onClick, style, allowFontScaling}: Props) => (
  <Text type="BodyPrimaryLink" onClick={onClick} style={style} allowFontScaling={!!allowFontScaling}>
    #{name}
  </Text>
)
