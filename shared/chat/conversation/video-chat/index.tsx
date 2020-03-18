import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {getSystemPreferences} from '../../../util/safe-electron'

const VideoChat = props => {
  const [localStream, setLocalStream] = React.useState()
  const [remoteStream, setRemoteStream] = React.useState()
  const [cachedLocalPC, setCachedLocalPC] = React.useState()
  const [cachedRemotePC, setCachedRemotePC] = React.useState()

  const _onStartVideoChat = async () => {
    const systemPreferences = getSystemPreferences()
    await systemPreferences.askForMediaAccess('microphone')
    await systemPreferences.askForMediaAccess('camera')
    const constraints = {audio: true, video: true}
    console.warn('calling getUserMedia')
    const newStream = await navigator.mediaDevices.getUserMedia(constraints)
    console.warn('called getUserMedia')
    await setLocalStream(newStream)
    const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
    const localPC = new RTCPeerConnection(configuration)
    const remotePC = new RTCPeerConnection(configuration)
  }

  return (
    <Kb.Box style={styles.outerContainer}>
      <Kb.Box style={styles.scrollContainer}>
        <Kb.Box2
          centerChildren={true}
          direction="vertical"
          style={styles.instructionsContainer}
          fullWidth={true}
          gap="tiny"
        >
          <Kb.Text style={styles.instructions} type="BodySmall">
            Start a video chat in this conversation.
          </Kb.Text>
          <Kb.Text style={styles.instructions} type="BodySmall">
            (Note that participants will discover your IP address.)
          </Kb.Text>
        </Kb.Box2>
        <Kb.Button label="Start a video chat" onClick={_onStartVideoChat} />
        {!!localStream && <video />}
        {!!remoteStream && <video />}
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        minHeight: 200,
      },
      image: {
        borderRadius: 0,
      },
      imageContainer: {
        alignSelf: 'flex-start',
        borderColor: Styles.globalColors.black,
        borderStyle: 'solid',
        borderWidth: Styles.globalMargins.xxtiny,
        margin: -1,
        overflow: 'hidden',
      },
      instructions: {
        alignSelf: 'center',
      },
      instructionsContainer: {
        justifyContent: 'center',
      },
      loadingContainer: {
        minHeight: 200,
      },
      outerContainer: {
        marginBottom: Styles.globalMargins.xtiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        position: 'relative',
      },
      scrollContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.boxShadow,
          border: `1px solid ${Styles.globalColors.black_20}`,
          borderRadius: Styles.borderRadius,
          maxHeight: 300,
          paddingBottom: Styles.globalMargins.tiny,
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)

export default VideoChat
