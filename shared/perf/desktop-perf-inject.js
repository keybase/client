// Desktop performance measurement script — inject via browser_evaluate in Electron.
// Creates window.__perf with start(), scrollContainer(), and stop() methods.
;(function () {
  if (window.__perf) return

  let running = false
  let startTime = 0
  let fpsSamples = []
  let longTaskEntries = []
  let memoryStart = null
  let memoryPeak = 0
  let marks = []
  let frameCount = 0
  let lastSecond = 0
  let rafId = null
  let longTaskObserver = null

  function sampleMemory() {
    // Chromium-only API, available in Electron
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / (1024 * 1024)
    }
    return 0
  }

  function countFrames(timestamp) {
    if (!running) return
    frameCount++
    const second = Math.floor(timestamp / 1000)
    if (lastSecond && second !== lastSecond) {
      fpsSamples.push(frameCount)
      const mem = sampleMemory()
      if (mem > memoryPeak) memoryPeak = mem
      frameCount = 0
    }
    lastSecond = second
    rafId = requestAnimationFrame(countFrames)
  }

  function percentile(arr, p) {
    if (!arr.length) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = Math.max(0, Math.ceil(sorted.length * (p / 100)) - 1)
    return sorted[idx]
  }

  window.__perf = {
    start() {
      running = true
      startTime = performance.now()
      fpsSamples = []
      longTaskEntries = []
      marks = []
      frameCount = 0
      lastSecond = 0
      memoryStart = sampleMemory()
      memoryPeak = memoryStart

      // Long task observer
      if (typeof PerformanceObserver !== 'undefined') {
        try {
          longTaskObserver = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              longTaskEntries.push({duration: entry.duration, startTime: entry.startTime})
            }
          })
          longTaskObserver.observe({entryTypes: ['longtask']})
        } catch (_e) {
          // longtask not supported
        }
      }

      rafId = requestAnimationFrame(countFrames)
    },

    scrollContainer(selector, options = {}) {
      const {distance = 2000, direction = 'down', stepMs = 16, stepPx = 50} = options
      return new Promise((resolve, reject) => {
        const el = document.querySelector(selector)
        if (!el) {
          reject(new Error('Element not found: ' + selector))
          return
        }
        let scrolled = 0
        const dir = direction === 'up' ? -1 : 1
        const interval = setInterval(() => {
          el.scrollTop += dir * stepPx
          scrolled += stepPx
          if (scrolled >= distance) {
            clearInterval(interval)
            resolve()
          }
        }, stepMs)
      })
    },

    stop() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      if (longTaskObserver) longTaskObserver.disconnect()

      const durationMs = performance.now() - startTime
      // Push the final partial-second frame count
      if (frameCount > 0) {
        fpsSamples.push(frameCount)
      }

      const memoryEnd = sampleMemory()
      const samples = fpsSamples.length ? fpsSamples : [0]
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length
      const min = Math.min(...samples)
      const max = Math.max(...samples)
      const p5 = percentile(samples, 5)

      const totalLongTaskMs = longTaskEntries.reduce((sum, e) => sum + e.duration, 0)

      // Collect any custom marks
      try {
        marks = performance.getEntriesByType('mark').map(m => ({name: m.name, startTime: m.startTime}))
      } catch (_e) {
        // ignore
      }

      return {
        durationMs: Math.round(durationMs),
        fps: {avg: Math.round(avg * 10) / 10, max, min, p5, samples},
        longTasks: {count: longTaskEntries.length, entries: longTaskEntries, totalMs: Math.round(totalLongTaskMs)},
        marks,
        memory: {
          endHeapMB: Math.round(memoryEnd * 10) / 10,
          peakHeapMB: Math.round(memoryPeak * 10) / 10,
          startHeapMB: Math.round(memoryStart * 10) / 10,
        },
      }
    },
  }
})()
