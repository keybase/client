import {canProcess, isVideoPath} from '../media-process'

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
