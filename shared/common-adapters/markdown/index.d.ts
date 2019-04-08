import * as React from 'react'
import * as Styles from '../../styles'
import { MessageText } from '../../constants/types/chat2';

type MarkdownComponentType = "inline-code" | "code-block" | "link" | "text" | "bold" | "italic" | "strike" | "emoji" | "native-emoji" | "quote-block";

export type MarkdownCreateComponent = (
  type: MarkdownComponentType,
  key: string,
  children: Array<React.ElementType>,
  options: {
    href?: string,
    convID?: string,
    bigEmoji?: boolean
  }
) => React.ElementType | null;

export type MarkdownMeta = {
  message: MessageText
};

export type StyleOverride = {
  paragraph?: Styles.StylesCrossPlatform,
  fence?: Styles.StylesCrossPlatform,
  inlineCode?: Styles.StylesCrossPlatform,
  strong?: Styles.StylesCrossPlatform,
  em?: Styles.StylesCrossPlatform,
  del?: Styles.StylesCrossPlatform,
  link?: Styles.StylesCrossPlatform,
  mailto?: Styles.StylesCrossPlatform,
  preview?: Styles.StylesCrossPlatform
};

export type Props = {
  preview?: boolean,
  style?: any,
  allowFontScaling?: boolean,
  meta?: MarkdownMeta | null,
  styleOverride?: StyleOverride
};

export default class Markdown extends React.Component<Props> {}
