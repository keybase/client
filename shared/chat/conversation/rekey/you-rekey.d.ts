import * as React from 'react'
export type Props = {
  onEnterPaperkey: () => void
  onBack: () => void
  onRekey: () => void
}
export default class YouRekey extends React.Component<Props> {}
