// Desktop-only DOM helper functions for init subscriptions.
// Isolated here so that native builds never encounter DOM types.
import {useShellState} from '@/stores/shell'

export const maybePauseVideos = () => {
  const {appFocused} = useShellState.getState()
  const videos = document.querySelectorAll('video')
  const allVideos = Array.from(videos)

  allVideos.forEach(v => {
    if (appFocused) {
      if (v.hasAttribute('data-focus-paused')) {
        if (v.paused) {
          v.play().then(() => {}).catch(() => {})
        }
      }
    } else {
      if (!v.paused && v.hasAttribute('loop') && v.hasAttribute('autoplay')) {
        v.setAttribute('data-focus-paused', 'true')
        v.pause()
      }
    }
  })
}

export const setupWindowEventListeners = (
  onFocus: () => void,
  onBlur: () => void,
  onOnline: () => void,
  onOffline: () => void
) => {
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
}
