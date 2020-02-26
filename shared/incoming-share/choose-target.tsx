import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as RPCTypes from '../constants/types/rpc-gen'

type Props = {
  items: Array<{
    shareType: RPCTypes.IncomingShareType
    filename?: string
  }>
  onBack: () => void
  onChat?: () => void
  onKBFS?: () => void
}

const incomingShareTypeToString = (
  shareType: RPCTypes.IncomingShareType,
  capitalize: boolean,
  plural: boolean
): string => {
  switch (shareType) {
    case RPCTypes.IncomingShareType.file:
      return (capitalize ? 'File' : 'file') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.text:
      return (capitalize ? 'Text' : 'text') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.image:
      return (capitalize ? 'Image' : 'image') + (plural ? 's' : '')
  }
}

const getContentDescription = (props: Props) => {
  if (props.items.length > 1 && props.items.some(({shareType}) => shareType !== props.items[0].shareType)) {
    return (
      <>
        <Kb.Text key="heading" type="Body">
          Where would you like to send these items?
        </Kb.Text>
        {props.items.some(({filename}) => !!filename) &&
          props.items.map(({shareType, filename}, i) => (
            <Kb.Text key={`item-${i}`} type="Body">
              {incomingShareTypeToString(shareType, true, false)}: {filename || '<unnamed>'}
            </Kb.Text>
          ))}
      </>
    )
  }

  return (
    <>
      <Kb.Text key="heading" type="Body">
        Where would you like to send {props.items.length > 1 ? `these ${props.items.length}` : 'this'}{' '}
        {incomingShareTypeToString(props.items[0].shareType, false, props.items.length > 1)}?
      </Kb.Text>
      {props.items.some(({filename}) => !!filename) &&
        props.items.map(({filename}, i) => (
          <Kb.Text key={`item-${i}`} type="Body">
            {filename || '<unnamed>'}
          </Kb.Text>
        ))}
    </>
  )
}

const ChooseTarget = (props: Props) =>
  !props.items.length ? (
    <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
      <Kb.ProgressIndicator type="Large" />
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader onBack={props.onBack} title="Incoming Content" />
      <Kb.Box2
        direction="vertical"
        gap="medium"
        fullWidth={true}
        gapStart={true}
        style={styles.container}
        centerChildren={true}
      >
        {getContentDescription(props)}
        <Kb.ButtonBar>
          <Kb.Button mode="Primary" label="Chat" onClick={props.onChat} disabled={!props.onChat} />
          <Kb.Button mode="Secondary" label="Files" onClick={props.onKBFS} disabled={!props.onKBFS} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )

export default ChooseTarget

const styles = Styles.styleSheetCreate(() => ({
  container: {
    flexGrow: 1,
    padding: Styles.globalMargins.small,
  },
}))
