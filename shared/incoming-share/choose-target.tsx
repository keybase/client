import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as FsTypes from '../constants/types/fs'
import * as FsConstants from '../constants/fs'

type Props = {
  erroredSendFeedback?: () => void
  items: Array<RPCTypes.IncomingShareItem>
  onCancel: () => void
  onChat?: (useOriginal: boolean) => void
  onKBFS?: (useOriginal: boolean) => void
}

const incomingShareTypeToString = (
  type: RPCTypes.IncomingShareType,
  capitalize: boolean,
  plural: boolean
): string => {
  switch (type) {
    case RPCTypes.IncomingShareType.file:
      return (capitalize ? 'File' : 'file') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.text:
      return (capitalize ? 'Text snippet' : 'text snippet') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.image:
      return (capitalize ? 'Image' : 'image') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.video:
      return (capitalize ? 'Video' : 'video') + (plural ? 's' : '')
  }
}

const getTextPreview = (contents: Array<string | null>) => {
  const firstNonEmpty = contents.find(Boolean)
  return firstNonEmpty ? (
    <>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.textContainer}>
        <Kb.Text type="Body">{firstNonEmpty}</Kb.Text>
      </Kb.Box2>
      {contents.length > 1 && <Kb.Text type="Body">and {contents.length - 1} more ...</Kb.Text>}
    </>
  ) : null
}

const AVPreview = (props: {thumbnailPaths: Array<FsTypes.LocalPath>}) => {
  return (
    <Kb.ScrollView horizontal={true} style={styles.imagesContanter}>
      {props.thumbnailPaths.map(originalPath => (
        <Kb.OrientedImage key={originalPath} src={originalPath} style={styles.image} />
      ))}
    </Kb.ScrollView>
  )
}

const isAV = (type: RPCTypes.IncomingShareType) =>
  type === RPCTypes.IncomingShareType.image || type === RPCTypes.IncomingShareType.video
const isSamePreviewType = (type1: RPCTypes.IncomingShareType, type2: RPCTypes.IncomingShareType) =>
  type1 === type2 || isAV(type1) === isAV(type2)

const getContentDescription = (props: Props) => {
  if (props.items.length > 1 && props.items.some(({type}) => !isSamePreviewType(type, props.items[0].type))) {
    return (
      <>
        <Kb.Text key="heading" type="Body">
          Where would you like to send these items?
        </Kb.Text>
        {props.items.some(({originalPath}) => !!originalPath) &&
          props.items.map(({type, originalPath}, i) => (
            <Kb.Text key={`item-${i}`} type="Body">
              {incomingShareTypeToString(type, true, false)}:{' '}
              {FsTypes.getLocalPathName(originalPath) || '<unnamed>'}
            </Kb.Text>
          ))}
      </>
    )
  }

  // Either we have one item, or a few items of the same type.

  const heading = (
    <Kb.Text key="heading" type="Header">
      {[
        ...props.items.reduce((types, {type}) => {
          types.set(type, (types.get(type) || 0) + 1)
          return types
        }, new Map()),
      ]
        .map(([type, count]) => `${count} ${incomingShareTypeToString(type, false, count > 1)}`)
        .join(' and ')}
    </Kb.Text>
  )

  switch (props.items[0].type) {
    case RPCTypes.IncomingShareType.text:
      return (
        <>
          {heading}
          {getTextPreview(props.items.map(({content}) => content || null))}
        </>
      )
    case RPCTypes.IncomingShareType.image:
    case RPCTypes.IncomingShareType.video:
      return (
        <>
          {heading}
          <AVPreview
            thumbnailPaths={props.items.map(({thumbnailPath, originalPath}) => thumbnailPath || originalPath)}
          />
        </>
      )
    case RPCTypes.IncomingShareType.file:
      return (
        <>
          {heading}
          {props.items.some(({originalPath}) => !!originalPath) &&
            props.items.map(({originalPath}, i) => (
              <Kb.Text key={`item-${i}`} type="Body">
                {FsTypes.getLocalPathName(originalPath) || '<unnamed>'}
              </Kb.Text>
            ))}
        </>
      )
  }
}

const ChooseTarget = (props: Props) => {
  const {onChat, onKBFS} = props
  const originalTotalSize = props.items.reduce((bytes, item) => bytes + item.originalSize, 0)
  const scaledTotalSize = props.items.reduce((bytes, item) => bytes + (item.scaledSize ?? 0), 0)
  const offerScaled = scaledTotalSize > 0 && scaledTotalSize < originalTotalSize
  const [useOriginalUserSelection, setUseOriginalUserSelection] = React.useState(false)
  const useOriginal = !offerScaled || useOriginalUserSelection

  if (props.erroredSendFeedback) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.HeaderHocHeader onCancel={props.onCancel} title="Share" />
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={styles.container}
          gap="small"
          centerChildren={true}
        >
          <Kb.Text type="BodySmall">Whoops! Something went wrong.</Kb.Text>
        </Kb.Box2>
        <Kb.Button label="Please let us know" style={styles.buttonBar} onClick={props.erroredSendFeedback} />
      </Kb.Box2>
    )
  }

  if (!props.items.length) {
    return (
      <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
        <Kb.ProgressIndicator type="Large" />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader onCancel={props.onCancel} title="Share" />
      <Kb.Box2
        direction="vertical"
        gap="small"
        fullWidth={true}
        gapStart={true}
        style={styles.container}
        centerChildren={true}
      >
        <Kb.Box2 direction="vertical" centerChildren={true} style={Styles.globalStyles.flexGrow}>
          {getContentDescription(props)}
        </Kb.Box2>

        {isAV(props.items[0].type) && offerScaled ? (
          <Kb.Box2 direction="vertical" alignItems="flex-start">
            <Kb.RadioButton
              key="compress"
              label={`Compress (${FsConstants.humanizeBytes(scaledTotalSize, 1)})`}
              selected={!useOriginalUserSelection}
              onSelect={s => s && setUseOriginalUserSelection(false)}
            />
            <Kb.RadioButton
              key="original"
              label={`Keep full size (${FsConstants.humanizeBytes(originalTotalSize, 1)})`}
              selected={useOriginalUserSelection}
              onSelect={s => s && setUseOriginalUserSelection(true)}
            />
          </Kb.Box2>
        ) : null}
        <Kb.ButtonBar style={styles.buttonBar}>
          <Kb.Button
            mode="Primary"
            label="Chat"
            onClick={onChat && (() => onChat(useOriginal))}
            disabled={!onChat}
          />
          <Kb.Button
            mode="Secondary"
            label="Files"
            onClick={onKBFS && (() => onKBFS(useOriginal))}
            disabled={!onKBFS}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

export default ChooseTarget

const styles = Styles.styleSheetCreate(() => ({
  buttonBar: {
    margin: Styles.globalMargins.small,
  },
  container: {
    flexGrow: 1,
    padding: Styles.globalMargins.tiny,
  },
  image: {
    height: 200,
    margin: Styles.globalMargins.tiny,
    width: 200,
  },
  imagesContanter: {
    height: 200 + 2 * Styles.globalMargins.small,
    margin: Styles.globalMargins.medium,
    maxHeight: 200 + 2 * Styles.globalMargins.small,
    padding: Styles.globalMargins.small,
  },
  textContainer: {
    borderStyle: 'solid',
    borderWidth: 1,
    margin: Styles.globalMargins.medium,
    padding: Styles.globalMargins.small,
  },
}))
