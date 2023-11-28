import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

const Prompt = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={styles.promptContainer}>
    <Kb.Text type="BodySmallSemibold">Select attachment type</Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      promptContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 24,
        paddingTop: 24,
      },
    }) as const
)

const FilePickerPopup = (p: Props) => {
  const items = Kb.Styles.isIOS
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
      ] as const)

  const header = <Prompt />
  return (
    <Kb.FloatingModalContext.Provider value="bottomsheet">
      <Kb.FloatingMenu
        header={header}
        attachTo={p.attachTo}
        items={items}
        onHidden={p.onHidden}
        visible={p.visible}
        closeOnSelect={true}
      />
    </Kb.FloatingModalContext.Provider>
  )
}

export default FilePickerPopup
