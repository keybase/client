import * as Kb from '@/common-adapters'
import type * as React from 'react'

type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  visible: boolean
  onHidden: () => void
  onSelect: (mediaType: 'photo' | 'video' | 'mixed' | 'file', location: 'camera' | 'library' | 'file') => void
}

const Prompt = () => {
  const styles = useStyles()
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      centerChildren={true}
      gap="xtiny"
      style={styles.promptContainer}
    >
      <Kb.Text type="BodySmallSemibold">Select attachment</Kb.Text>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      promptContainer: {
        ...Kb.Styles.paddingV(24),
      },
    }) as const
)

const FilePickerPopupImpl = (p: Props) => {
  const onSelect = p.onSelect
  const items = isIOS
    ? ([
        {
          icon: 'iconfont-camera',
          onClick: () => onSelect('mixed', 'camera'),
          title: 'Take photo or video',
        },
        {
          icon: 'iconfont-photo-library',
          onClick: () => onSelect('mixed', 'library'),
          title: 'Choose from library',
        },
        {
          icon: 'iconfont-attachment',
          onClick: () => onSelect('file', 'file'),
          title: 'Choose a file',
        },
      ] as const)
    : // the library picker handles mixed on both platforms, but Android's camera
      // is two separate intents (ACTION_IMAGE_CAPTURE / ACTION_VIDEO_CAPTURE) and
      // a mixed request silently resolves to photo-only, so capture stays split.
      ([
        {
          icon: 'iconfont-camera',
          onClick: () => onSelect('photo', 'camera'),
          title: 'Take photo',
        },
        {icon: 'iconfont-film', onClick: () => onSelect('video', 'camera'), title: 'Take video'},
        {
          icon: 'iconfont-photo-library',
          onClick: () => onSelect('mixed', 'library'),
          title: 'Choose from library',
        },
        {
          icon: 'iconfont-attachment',
          onClick: () => onSelect('file', 'file'),
          title: 'Choose a file',
        },
      ] as const)

  return (
    <Kb.FloatingMenu
      header={<Prompt />}
      attachTo={p.attachTo}
      items={items}
      mode="bottomsheet"
      onHidden={p.onHidden}
      visible={p.visible}
      closeOnSelect={true}
    />
  )
}

const FilePickerPopup = isMobile ? FilePickerPopupImpl : () => null
export default FilePickerPopup
