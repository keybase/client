import {
  canProcess,
  clampRange,
  deleteConsumedSources,
  discardProcessedOutputs,
  formatDuration,
  isEditNoop,
  isVideoPath,
  minTrimMs,
  processPaths,
} from '../media-process'
import {processMedia} from 'react-native-kb'

// Both native-only packages resolve to this one stub through jest.config's
// moduleNameMapper, so that's what has to carry the mocks: mocking them under
// their own names never reaches the mapped module.
jest.mock('@/test/mocks/native-module', () => {
  const deleted: Array<string> = []
  return {
    File: class {
      private readonly path: string
      constructor(path: string) {
        this.path = path
      }
      delete() {
        deleted.push(this.path)
      }
    },
    deleted,
    processMedia: jest.fn(),
  }
})

const processMediaMock = processMedia as jest.MockedFunction<typeof processMedia>
const {deleted} = jest.requireMock<{deleted: Array<string>}>('@/test/mocks/native-module')

describe('isVideoPath', () => {
  it('matches common video extensions case-insensitively', () => {
    expect(isVideoPath('/tmp/clip.mp4')).toBe(true)
    expect(isVideoPath('/tmp/clip.MOV')).toBe(true)
    expect(isVideoPath('/tmp/clip.mkv')).toBe(true)
  })

  it('rejects images and other files', () => {
    expect(isVideoPath('/tmp/photo.jpg')).toBe(false)
    expect(isVideoPath('/tmp/doc.pdf')).toBe(false)
    expect(isVideoPath('/tmp/movie')).toBe(false)
  })
})

describe('canProcess', () => {
  it('includes videos and images the processor can transcode', () => {
    expect(canProcess('/tmp/clip.mov')).toBe(true)
    expect(canProcess('/tmp/photo.jpg')).toBe(true)
    expect(canProcess('/tmp/IMG_0001.HEIC')).toBe(true)
    expect(canProcess('/tmp/photo.heif')).toBe(true)
  })

  it('includes formats the share extension passes through for the app to transcode', () => {
    for (const ext of ['tiff', 'TIF', 'dng', 'CR2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'webp', 'avif']) {
      expect(canProcess(`/tmp/photo.${ext}`)).toBe(true)
    }
    expect(canProcess('/tmp/photo.tiff/notanimage')).toBe(false)
  })

  it('excludes gifs and non-media', () => {
    expect(canProcess('/tmp/anim.gif')).toBe(false)
    expect(canProcess('/tmp/doc.pdf')).toBe(false)
  })
})

describe('isEditNoop', () => {
  it('treats a full range with audio kept as nothing to do', () => {
    expect(isEditNoop(undefined)).toBe(true)
    expect(isEditNoop({endMs: 0, removeAudio: false, startMs: 0})).toBe(true)
  })

  it('counts a moved handle or a muted clip as an edit', () => {
    expect(isEditNoop({endMs: 0, removeAudio: false, startMs: 500})).toBe(false)
    expect(isEditNoop({endMs: 9000, removeAudio: false, startMs: 0})).toBe(false)
    expect(isEditNoop({endMs: 0, removeAudio: true, startMs: 0})).toBe(false)
  })
})

describe('clampRange', () => {
  it('keeps handles inside the clip', () => {
    expect(clampRange(-500, 99_000, 10_000, 'start')).toEqual({endMs: 10_000, startMs: 0})
  })

  it('pushes the end away when the start crowds it', () => {
    expect(clampRange(4800, 5000, 10_000, 'start')).toEqual({endMs: 5800, startMs: 4800})
  })

  it('pushes the start away when the end crowds it', () => {
    expect(clampRange(5000, 5200, 10_000, 'end')).toEqual({endMs: 5200, startMs: 4200})
  })

  it('pins the start when the end is dragged past the head', () => {
    expect(clampRange(0, 0, 10_000, 'end')).toEqual({endMs: minTrimMs, startMs: 0})
  })

  it('gives back the whole clip when it is too short to trim', () => {
    expect(clampRange(200, 400, 800, 'start')).toEqual({endMs: 800, startMs: 0})
  })
})

describe('formatDuration', () => {
  it('renders m:ss and never goes negative', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(4200)).toBe('0:04')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(-1000)).toBe('0:00')
  })
})

describe('processPaths', () => {
  beforeEach(() => {
    processMediaMock.mockReset()
    deleted.length = 0
    global.isIOS = true
  })

  afterAll(() => {
    global.isIOS = false
  })

  it('hands the paths straight back off iOS', async () => {
    global.isIOS = false
    const out = await processPaths([{path: '/tmp/clip.mp4'}], true)
    expect(out).toEqual([{path: '/tmp/clip.mp4'}])
    expect(processMediaMock).not.toHaveBeenCalled()
    expect(deleted).toEqual([])
  })

  it('forwards the edit and the video flag, and reports progress per item', async () => {
    processMediaMock.mockImplementation(async path => Promise.resolve(`${path}.out`))
    const onProgress = jest.fn()
    const out = await processPaths(
      [{edit: {endMs: 9000, removeAudio: true, startMs: 500}, path: '/tmp/clip.mp4'}, {path: '/tmp/photo.jpg'}],
      true,
      onProgress
    )
    expect(out).toEqual([{path: '/tmp/clip.mp4.out'}, {path: '/tmp/photo.jpg.out'}])
    expect(processMediaMock).toHaveBeenNthCalledWith(1, '/tmp/clip.mp4', true, true, 500, 9000, true)
    expect(processMediaMock).toHaveBeenNthCalledWith(2, '/tmp/photo.jpg', false, true, 0, 0, false)
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ])
  })

  it('leaves every file in place, since the caller may still back out', async () => {
    processMediaMock.mockImplementation(async path => Promise.resolve(`${path}.out`))
    await processPaths([{path: '/tmp/clip.mp4'}, {path: '/tmp/photo.jpg'}], true)
    expect(deleted).toEqual([])
  })

  it('reports a failure against the original', async () => {
    processMediaMock.mockImplementation(async path =>
      path === '/tmp/photo.jpg' ? Promise.reject(new Error('nope')) : Promise.resolve(`${path}.out`)
    )
    const out = await processPaths([{path: '/tmp/clip.mp4'}, {path: '/tmp/photo.jpg'}], true)
    expect(out).toEqual([{path: '/tmp/clip.mp4.out'}, {error: 'nope', path: '/tmp/photo.jpg'}])
  })

  it('treats an empty native error as a failure', async () => {
    processMediaMock.mockImplementation(async path =>
      path === '/tmp/photo.jpg' ? Promise.reject(new Error('')) : Promise.resolve(`${path}.out`)
    )
    const out = await processPaths([{path: '/tmp/clip.mp4'}, {path: '/tmp/photo.jpg'}], true)
    expect(out[1]).toEqual({error: 'Processing failed', path: '/tmp/photo.jpg'})
  })

  it('keeps going after a failure so the rest of the batch still exports', async () => {
    processMediaMock.mockImplementation(async path =>
      path === '/tmp/a.jpg' ? Promise.reject(new Error('nope')) : Promise.resolve(`${path}.out`)
    )
    const out = await processPaths([{path: '/tmp/a.jpg'}, {path: '/tmp/b.jpg'}], true)
    expect(processMediaMock).toHaveBeenCalledTimes(2)
    expect(out[1]).toEqual({path: '/tmp/b.jpg.out'})
  })
})

describe('deleteConsumedSources', () => {
  beforeEach(() => {
    deleted.length = 0
  })

  it('deletes the sources an uploaded batch consumed', () => {
    deleteConsumedSources(
      [{path: '/tmp/clip.mp4'}, {path: '/tmp/photo.jpg'}],
      [{path: '/tmp/clip.mp4.out'}, {path: '/tmp/photo.jpg.out'}]
    )
    expect(deleted).toEqual(['/tmp/clip.mp4', '/tmp/photo.jpg'])
  })

  it('keeps a source the processor handed back untouched', () => {
    // that path is the upload, so deleting it would delete the attachment
    deleteConsumedSources([{path: '/tmp/photo.jpg'}], [{path: '/tmp/photo.jpg'}])
    expect(deleted).toEqual([])
  })

  it('keeps every source when any item failed', () => {
    // one failure sends the user to "send original", which uploads these very paths
    deleteConsumedSources(
      [{path: '/tmp/clip.mp4'}, {path: '/tmp/photo.jpg'}],
      [{path: '/tmp/clip.mp4.out'}, {error: 'nope', path: '/tmp/photo.jpg'}]
    )
    expect(deleted).toEqual([])
  })
})

describe('discardProcessedOutputs', () => {
  beforeEach(() => {
    deleted.length = 0
  })

  it('deletes the outputs and never an original', () => {
    discardProcessedOutputs(
      [{path: '/tmp/clip.mp4'}, {path: '/tmp/photo.jpg'}, {path: '/tmp/scan.jpg'}],
      [{path: '/tmp/clip.mp4.out'}, {error: 'nope', path: '/tmp/photo.jpg'}, {path: '/tmp/scan.jpg'}]
    )
    // a failed item and a passthrough both report the original
    expect(deleted).toEqual(['/tmp/clip.mp4.out'])
  })
})
