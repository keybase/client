import * as Kb from '@/common-adapters'
import type * as React from 'react'

type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  visible: boolean
  onHidden: () => void
  onSelect: (mediaType: 'photo' | 'video' | 'mixed' | 'file', location: 'camera' | 'library' | 'file') => void
}

const Prompt = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="xtiny" style={styles.promptContainer} justifyContent="center">
    <Kb.Text type="BodySmallSemibold">Select attachment</Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      promptContainer: {
        ...Kb.Styles.paddingV(24),
      },
    }) as const
)

const FilePickerPopupImpl = (p: Props) => {
  const items = isIOS
    ? ([
        {
          icon: 'iconfont-camera',
          onClick: () => p.onSelect('mixed', 'camera'),
          title: 'Take photo or video',
        },
        {
          icon: 'iconfont-video-library',
          onClick: () => p.onSelect('video', 'library'),
          title: 'Choose video from library',
        },
        {
          icon: 'iconfont-photo-library',
          onClick: () => p.onSelect('photo', 'library'),
          title: 'Choose photos from library',
        },
        {
          icon: 'iconfont-attachment',
          onClick: () => p.onSelect('file', 'file'),
          title: 'Choose a file',
        },
      ] as const)
    : ([
        {
          icon: 'iconfont-camera',
          onClick: () => p.onSelect('photo', 'camera'),
          title: 'Take photo',
        },
        {icon: 'iconfont-film', onClick: () => p.onSelect('video', 'camera'), title: 'Take video'},
        {
          icon: 'iconfont-photo-library',
          onClick: () => p.onSelect('photo', 'library'),
          title: 'Photo from library',
        },
        {
          icon: 'iconfont-video-library',
          onClick: () => p.onSelect('video', 'library'),
          title: 'Video from library',
        },
        {
          icon: 'iconfont-attachment',
          onClick: () => p.onSelect('file', 'file'),
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
