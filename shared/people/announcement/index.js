// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'

type Props = {|
  appLink: ?string,
  badged: boolean,
  confirmLabel: ?string,
  onConfirm: () => void,
  onDismiss: ?() => void,
  text: string,
  url: ?string,
|}

const Announcement = (props: Props) => {
  return (
    <>
      <Kb.Text type="Body">TODO</Kb.Text>
    </>
  )
}

export default Announcement
