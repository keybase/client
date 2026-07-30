import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Styles from '@/styles'
import {View} from 'react-native'
import {GestureDetector, usePanGesture} from 'react-native-gesture-handler'
import {VideoView, useVideoPlayer} from 'expo-video'
import {useEventListener} from 'expo'
import {useNavigation} from '@react-navigation/native'
import {clampRange, formatDuration, minTrimMs, type VideoEdit} from '@/util/media-process'

type Props = {
  edit?: VideoEdit
  onEdit: (edit: VideoEdit) => void
  path: string
}

const handleWidth = 14
const trackHeight = 40
// The end handle sitting this close to the tail counts as untrimmed, so a stray
// pixel of drag doesn't force an export.
const tailEpsilonMs = 50
// A drag can outrun the player; seeking on every move event stutters the preview.
const seekIntervalMs = 60
// Seeks land within seekTolerance of the request, so a correction back to the in
// point can undershoot. Anything inside this window counts as "at start",
// otherwise the correction seeks forever.
const seekSlopMs = 400

// Playback here judders on the simulator — audio especially — no matter what the
// player is doing; master's plain Kb.Video preview does it too, and a device is
// clean. Don't chase it from this component.
const AttachmentTrim = (props: Props) => {
  const {edit, onEdit, path} = props
  const uri = Styles.normalizePath(Styles.urlEscapeFilePath(path))
  const player = useVideoPlayer(uri, p => {
    p.muted = true
    p.pause()
    // A drag is a burst of seeks. Frame-exact seeking (the default) makes each
    // one expensive enough to stutter the handle, and a quarter second of slop
    // is invisible when you're picking a cut point.
    p.seekTolerance = {toleranceAfter: 0.25, toleranceBefore: 0.25}
    // Tight enough that playback stops near the out point rather than visibly
    // past it, without waking JS every frame.
    p.timeUpdateEventInterval = 0.1
  })

  const [durationMs, setDurationMs] = React.useState(0)
  const [trackWidth, setTrackWidth] = React.useState(0)

  // sourceLoad carries the duration with it. statusChange alone missed clips that
  // finished loading before the listener attached — no duration meant no trim bar
  // at all — and both listeners attach from effects, so the deferred read covers
  // a file that loads before either is live.
  useEventListener(player, 'sourceLoad', ({duration}) => {
    if (duration > 0) {
      setDurationMs(Math.round(duration * 1000))
    }
  })
  useEventListener(player, 'statusChange', ({status}) => {
    if (status !== 'readyToPlay') return
    try {
      const d = player.duration
      if (d > 0) {
        setDurationMs(Math.round(d * 1000))
      }
    } catch {}
  })
  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        const d = player.duration
        if (d > 0) {
          setDurationMs(Math.round(d * 1000))
        }
      } catch {}
    }, 0)
    return () => {
      clearTimeout(id)
    }
  }, [player])

  const removeAudio = edit?.removeAudio ?? false
  // The live handle positions. Held locally because routing every move event up
  // to the modal and back leaves the handles a render behind the finger; the
  // parent only hears about the range when the drag ends.
  const [range, setRange] = React.useState<{endMs: number; startMs: number} | undefined>()
  const startMs = range?.startMs ?? edit?.startMs ?? 0
  const endMs = range?.endMs ?? (edit?.endMs || durationMs)

  // Where the paused player should sit. Set while dragging so the frame under the
  // handle is what you see; an effect does the seeking because the player can't
  // be mutated during render.
  const [previewMs, setPreviewMs] = React.useState<number | undefined>()
  React.useEffect(() => {
    if (previewMs === undefined) return
    try {
      player.pause()
      // seekBy rather than assigning currentTime: mutating a hook's value is a
      // compiler bailout, and the delta lands in the same place.
      player.seekBy(previewMs / 1000 - player.currentTime)
    } catch {
      // the player's native object can be released mid-drag
    }
  }, [player, previewMs])

  // Playback stays inside the selection, so hitting play on the native controls
  // previews the cut instead of the whole clip. Everything this needs arrives in
  // the event payloads: reading player properties per tick means a synchronous
  // hop to the native object while it's decoding.
  const playingRef = React.useRef(false)
  useEventListener(player, 'playingChange', ({isPlaying}) => {
    playingRef.current = isPlaying
  })
  useEventListener(player, 'timeUpdate', ({currentTime}) => {
    if (durationMs <= 0 || !playingRef.current) return
    const ms = currentTime * 1000
    // Only touch the player when the playhead is actually outside the window.
    if (ms < endMs && ms >= startMs - seekSlopMs) return
    try {
      if (ms >= endMs) {
        player.pause()
      }
      player.seekBy((startMs - ms) / 1000)
    } catch {
      // released player
    }
  })

  // Which handle the touch grabbed. A ref, not state: the very next move event
  // has to see it, and a re-render is a frame too late.
  const draggingRef = React.useRef<'start' | 'end'>('start')
  const lastSeekRef = React.useRef(0)

  // The modal is a native sheet, so a vertical component of the drag slides the
  // whole screen. Refusing JS responder termination can't stop a native
  // recognizer; turning off interactive dismissal for the duration can.
  const navigation = useNavigation()
  const [dragging, setDragging] = React.useState(false)
  React.useEffect(() => {
    navigation.setOptions({gestureEnabled: !dragging})
  }, [dragging, navigation])

  const msAt = (locationX: number) =>
    trackWidth > 0 ? (Math.min(Math.max(0, locationX), trackWidth) / trackWidth) * durationMs : 0

  const onTouch = (locationX: number, grabbing: boolean) => {
    if (durationMs <= 0 || trackWidth <= 0) return
    const at = msAt(locationX)
    // The track owns the gesture, so a touch grabs whichever handle it landed
    // nearer to and keeps it for the rest of the drag.
    if (grabbing) {
      draggingRef.current = Math.abs(at - startMs) <= Math.abs(at - endMs) ? 'start' : 'end'
      setDragging(true)
    }
    const moved = draggingRef.current
    const next = clampRange(
      moved === 'start' ? at : startMs,
      moved === 'end' ? at : endMs,
      durationMs,
      moved
    )
    setRange({endMs: Math.round(next.endMs), startMs: Math.round(next.startMs)})
    const now = Date.now()
    if (grabbing || now - lastSeekRef.current >= seekIntervalMs) {
      lastSeekRef.current = now
      setPreviewMs(Math.round(moved === 'start' ? next.startMs : next.endMs))
    }
  }

  const commit = (audioOff = removeAudio) => {
    setDragging(false)
    if (durationMs <= 0) return
    // An end handle left at the tail is not a trim, so it goes up as 0 and the
    // clip skips the export when nothing else changed.
    const atTail = endMs >= durationMs - tailEpsilonMs
    onEdit({
      endMs: atTail ? 0 : Math.round(endMs),
      removeAudio: audioOff,
      startMs: Math.round(startMs),
    })
  }

  // gesture-handler rather than the responder system: its x stays relative to
  // the track once the finger wanders off it (the responder system re-bases the
  // coordinate onto whatever view is now under the touch), and it holds the
  // gesture against the sheet's own recognizer instead of being cancelled.
  // runOnJS because everything it touches is React state, not a worklet.
  const pan = usePanGesture({
    maxPointers: 1,
    minDistance: 0,
    onBegin: e => {
      onTouch(e.x, true)
    },
    onFinalize: () => {
      commit()
    },
    onUpdate: e => {
      onTouch(e.x, false)
    },
    runOnJS: true,
    shouldCancelWhenOutside: false,
  })

  const canTrim = durationMs > minTrimMs
  const startFrac = durationMs > 0 ? startMs / durationMs : 0
  const endFrac = durationMs > 0 ? endMs / durationMs : 1
  const selectedLeft = startFrac * trackWidth
  const selectedWidth = Math.max(0, (endFrac - startFrac) * trackWidth)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.videoContainer}>
        <VideoView player={player} nativeControls={true} contentFit="contain" style={styles.video} />
      </Kb.Box2>
      {canTrim ? (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.controls}>
          <GestureDetector gesture={pan}>
            <View
              style={styles.track}
              onLayout={e => {
                setTrackWidth(e.nativeEvent.layout.width)
              }}
            >
              {/* what the cut throws away */}
              <View style={[styles.dim, {left: 0, width: selectedLeft}]} />
              <View
                style={[
                  styles.dim,
                  {left: selectedLeft + selectedWidth, width: Math.max(0, trackWidth - selectedLeft - selectedWidth)},
                ]}
              />
              <View style={[styles.selected, {left: selectedLeft, width: selectedWidth}]} />
              <View style={[styles.handle, styles.handleLeft, {left: selectedLeft}]} />
              <View
                style={[styles.handle, styles.handleRight, {left: selectedLeft + selectedWidth - handleWidth}]}
              />
            </View>
          </GestureDetector>
          <Kb.Text type="BodySmall" center={true}>
            {`${formatDuration(startMs)} – ${formatDuration(endMs)} (${formatDuration(endMs - startMs)} of ${formatDuration(durationMs)})`}
          </Kb.Text>
        </Kb.Box2>
      ) : null}
      <Kb.Checkbox
        label="Remove audio"
        checked={removeAudio}
        style={styles.checkbox}
        onCheck={checked => {
          commit(checked)
        }}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      checkbox: {
        alignSelf: 'center',
        flexShrink: 0,
        marginTop: Styles.globalMargins.xtiny,
      },
      controls: {
        flexShrink: 0,
        paddingTop: Styles.globalMargins.tiny,
      },
      dim: {
        backgroundColor: Styles.globalColors.black_20,
        bottom: 0,
        position: 'absolute',
        top: 0,
      },
      handle: {
        backgroundColor: Styles.globalColors.yellow,
        bottom: 0,
        position: 'absolute',
        top: 0,
        width: handleWidth,
      },
      handleLeft: {
        borderBottomLeftRadius: Styles.borderRadius,
        borderTopLeftRadius: Styles.borderRadius,
      },
      handleRight: {
        borderBottomRightRadius: Styles.borderRadius,
        borderTopRightRadius: Styles.borderRadius,
      },
      selected: {
        borderColor: Styles.globalColors.yellow,
        borderWidth: 2,
        bottom: 0,
        position: 'absolute',
        top: 0,
      },
      track: {
        backgroundColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        height: trackHeight,
        overflow: 'hidden',
        width: '100%',
      },
      video: {...Styles.size('100%')},
      videoContainer: {
        flexGrow: 1,
        flexShrink: 1,
      },
    }) as const
)

export default AttachmentTrim
