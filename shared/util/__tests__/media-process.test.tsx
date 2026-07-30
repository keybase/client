import {canProcess, clampRange, formatDuration, isEditNoop, isVideoPath, minTrimMs} from '../media-process'

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
