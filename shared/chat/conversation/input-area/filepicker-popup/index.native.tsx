import * as React from 'react'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
import {Props} from '.'
import {isIOS} from '../../../../constants/platform'

const Prompt = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={styles.promptContainer}>
    <Kb.Text type="BodySmallSemibold">Select attachment type</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      promptContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 24,
        paddingTop: 24,
      },
    } as const)
)

class FilePickerPopup extends React.Component<Props> {
  render() {
    const iosItems: Kb.MenuItems = [
      {
        icon: 'iconfont-camera',
        onClick: () => this.props.onSelect('mixed', 'camera'),
        title: 'Take photo or video',
      },
      {
        icon: 'iconfont-photo-library',
        onClick: () => this.props.onSelect('mixed', 'library'),
        title: 'Choose from library',
      },
    ]

    const androidItems: Kb.MenuItems = [
      {icon: 'iconfont-camera', onClick: () => this.props.onSelect('photo', 'camera'), title: 'Take photo'},
      {icon: 'iconfont-film', onClick: () => this.props.onSelect('video', 'camera'), title: 'Take video'},
      {
        icon: 'iconfont-photo-library',
        onClick: () => this.props.onSelect('photo', 'library'),
        title: 'Photo from library',
      },
      {
        icon: 'iconfont-video-library',
        onClick: () => this.props.onSelect('video', 'library'),
        title: 'Video from library',
      },
    ]
    const items = isIOS ? iosItems : androidItems

    const header = <Prompt />
    return (
      <Kb.FloatingMenu
        header={header}
        attachTo={this.props.attachTo}
        items={items}
        onHidden={this.props.onHidden}
        visible={this.props.visible}
        closeOnSelect={true}
      />
    )
  }
}

export default FilePickerPopup
