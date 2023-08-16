import Text, {type StylesTextCrossPlatform} from './text'
import type * as T from '../constants/types'

export type Props = {
  name: string
  convID: T.Chat.ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean
  onClick: () => void
}

export const Channel = ({name, onClick, style, allowFontScaling}: Props) => (
  <Text type="BodyPrimaryLink" onClick={onClick} style={style} allowFontScaling={!!allowFontScaling}>
    #{name}
  </Text>
)
