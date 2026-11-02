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
    expect(requireOneItem([file], {ext: '.pdf', type: 'file'})).toBe(file)
    expect(() => requireOneItem(undefined, {type: 'file'})).toThrow('no manifest')
    expect(() => requireOneItem([], {type: 'file'})).toThrow('0 items')
    expect(() => requireOneItem([file, file], {type: 'file'})).toThrow('2 items')
    expect(() => requireOneItem([{error: 'x'}], {type: 'file'})).toThrow('could not prepare')
    expect(() => requireOneItem([file], {type: 'image'})).toThrow('not a image')
    expect(() => requireOneItem([file], {ext: '.png', type: 'file'})).toThrow('not a .png')
    expect(() => requireOneItem([{type: 'image'}], {type: 'image'})).toThrow('no file')
    expect(requireOneItem([{content: 't', type: 'text'}], {content: 't', type: 'text'}).content).toBe('t')
    expect(() => requireOneItem([{content: 'u', type: 'text'}], {content: 't', type: 'text'})).toThrow('not the text shared')
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

  test('unfurlFetchProblem refuses unless unfurls are off or the domain is not whitelisted', () => {
    expect(unfurlFetchProblem({mode: 1}, 'maps.apple.com')).toBeUndefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['keybase.io']}, 'maps.apple.com')).toBeUndefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['apple.com']}, 'maps.apple.com')).toBeDefined()
    expect(unfurlFetchProblem({mode: 2, whitelist: ['maps.apple.com']}, 'maps.apple.com')).toBeDefined()
    expect(unfurlFetchProblem({mode: 0}, 'maps.apple.com')).toBeDefined()
  })

  test('mapsShareProblem wants the place name and an Apple Maps link', () => {
    expect(mapsShareProblem('e2e-p\nhttps://maps.apple.com/?q=x', 'e2e-p')).toBeUndefined()
    expect(mapsShareProblem('https://maps.apple.com/?q=x', 'e2e-p')).toContain('place name')
    expect(mapsShareProblem('e2e-p\nhttps://example.com/', 'e2e-p')).toContain('link')
  })

})
