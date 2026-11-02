import {extensionRequests, mapsShareProblem, parseManifest, payloadFolder, requireOneItem, textPage, unfurlFetchProblem} from './share-lib'

const root = '/c/group/Library/Caches/incoming-shares'

describe('share-lib', () => {
  test('parseManifest keeps string fields only and refuses a non-list', () => {
    expect(parseManifest('[{"type":"image","originalPath":"/a","extra":1,"content":2}]')).toEqual([
      {content: undefined, error: undefined, originalPath: '/a', type: 'image'},
    ])
    expect(() => parseManifest('{"type":"image"}')).toThrow('not a list')
    expect(() => parseManifest('[null]')).toThrow('not an object')
  })

  test('requireOneItem wants exactly one prepared item of the type, extension and text', () => {
    const file = {originalPath: `${root}/s/i/e2e-c.pdf`, type: 'file'}
    expect(requireOneItem({items: [file]}, {ext: '.pdf', type: 'file'})).toBe(file)
    expect(() => requireOneItem({}, {type: 'file'})).toThrow('no manifest')
    expect(() => requireOneItem({items: []}, {type: 'file'})).toThrow('0 items')
    expect(() => requireOneItem({items: [file, file]}, {type: 'file'})).toThrow('2 items')
    expect(() => requireOneItem({items: [{error: 'x'}]}, {type: 'file'})).toThrow('could not prepare')
    expect(() => requireOneItem({items: [file]}, {type: 'image'})).toThrow('not a image')
    expect(() => requireOneItem({items: [file]}, {ext: '.png', type: 'file'})).toThrow('not a .png')
    expect(() => requireOneItem({items: [{type: 'image'}]}, {type: 'image'})).toThrow('no file')
    expect(requireOneItem({items: [{content: 't', type: 'text'}]}, {content: 't', type: 'text'}).content).toBe('t')
    expect(() => requireOneItem({items: [{content: 'u', type: 'text'}]}, {content: 't', type: 'text'})).toThrow('not the text shared')
  })

  test("requireOneItem reports a file it could not record for the cleanup, not the manifest's shape", () => {
    const why = 'a shared file is not in a payload folder of incoming-shares'
    expect(() => requireOneItem({folderProblem: why, items: [{originalPath: '/elsewhere/f.png', type: 'image'}]}, {type: 'image'})).toThrow(why)
  })

  test('payloadFolder answers the share folder only for root/<share>/<item>/<file>', () => {
    expect(payloadFolder(root, `${root}/s/i/f.png`)).toBe(`${root}/s`)
    expect(() => payloadFolder(root, `${root}/s/f.png`)).toThrow()
    expect(() => payloadFolder(root, `${root}/manifest.json`)).toThrow()
    expect(() => payloadFolder(root, '/elsewhere/s/i/f.png')).toThrow()
    expect(() => payloadFolder(root, `${root}/../x/i/f.png`)).toThrow()
    expect(() => payloadFolder(root, `${root}/s/i/j/f.png`)).toThrow()
  })

  test('textPage holds a marker only', () => {
    expect(textPage('shared text', 'e2e-abc-share')).toContain('<textarea aria-label="shared text" rows="4" cols="30">e2e-abc-share</textarea>')
    expect(() => textPage('shared text', '<script>')).toThrow()
    expect(() => textPage('"x', 'e2e')).toThrow()
  })

  test("extensionRequests keeps the extension's requests from `since` on", () => {
    const reqs = [
      {method: 'GET', path: '/a', userAgent: 'KeybaseShare/1'},
      {method: 'GET', path: '/b', userAgent: 'Safari'},
      {method: 'HEAD', path: '/c', userAgent: 'KeybaseShare/1'},
    ]
    expect(extensionRequests(reqs, 1)).toEqual([reqs[2]])
  })

  test('unfurlFetchProblem refuses a link of the text the service would fetch', () => {
    const text = 'https://maps.apple/p/abc\ne2e-p'
    expect(unfurlFetchProblem({mode: 1}, text)).toBeUndefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['keybase.io']}, text)).toBeUndefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['maps.apple']}, text)).toBeDefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['apple']}, text)).toBeDefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['apple.com']}, 'see https://maps.apple.com/x')).toBeDefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['apple.com']}, text)).toBeUndefined()
    expect(unfurlFetchProblem({mode: 0}, text)).toBeDefined()
    expect(unfurlFetchProblem({mode: 1}, 'https://media.giphy.com/x')).toBeDefined()
    expect(unfurlFetchProblem({mode: 0}, 'e2e-p only')).toBeUndefined()
  })

  test('mapsShareProblem wants the place name and an Apple Maps link', () => {
    expect(mapsShareProblem('e2e-p\nhttps://maps.apple.com/?q=x', 'e2e-p')).toBeUndefined()
    expect(mapsShareProblem('https://maps.apple.com/?q=x', 'e2e-p')).toContain('place name')
    expect(mapsShareProblem('e2e-p\nhttps://example.com/', 'e2e-p')).toContain('link')
  })
})
