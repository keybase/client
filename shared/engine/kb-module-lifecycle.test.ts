// Static guard for the Android "back button wedge" (HOTPOT-rpc-fixes,
// fixed in 15647bb4d4). On Android, onHostDestroy fires when the LAST
// ACTIVITY is destroyed while the ReactInstance/TurboModules survive
// (MainApplication holds the ReactHost in an application-scoped `by lazy`).
// nativeInvalidate() nulls the C++ g_bridge, which only the bindings
// installer repopulates -- and a surviving ReactInstance never re-runs
// that installer. If nativeInvalidate() is reachable from destroy()/
// onHostDestroy() instead of from invalidate() (real TurboModule teardown,
// e.g. reload), every inbound RPC is silently dropped for the life of the
// process after pressing back to home and reopening the app. This was
// shipped past two per-task reviews; only a whole-branch review caught it.
// This test parses actual function bodies (brace-matched, not a whole-file
// substring search) so it survives reformatting but still catches the call
// moving to the wrong function.
import * as fs from 'fs'
import * as path from 'path'

const kbModulePath = path.join(
  __dirname,
  '..',
  '..',
  'rnmodules',
  'react-native-kb',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativekb',
  'KbModule.kt'
)

// Extracts the body of a Kotlin function whose signature matches `namePattern`,
// via brace-depth counting from the first `{` after the signature -- not a
// line-based or whole-file match, so it scopes strictly to that one function
// even if other functions elsewhere also mention nativeInvalidate().
function extractFunctionBody(source: string, namePattern: RegExp): string {
  const sigMatch = namePattern.exec(source)
  if (!sigMatch) {
    throw new Error(`KbModule.kt: could not find a function matching ${namePattern}`)
  }
  const openBraceIdx = source.indexOf('{', sigMatch.index)
  if (openBraceIdx === -1) {
    throw new Error(`KbModule.kt: found signature for ${namePattern} but no function body`)
  }
  let depth = 0
  for (let i = openBraceIdx; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(openBraceIdx + 1, i)
    }
  }
  throw new Error(`KbModule.kt: unterminated function body for ${namePattern}`)
}

// Matches a real call `nativeInvalidate()`, not the `external fun
// nativeInvalidate()` declaration (which has no body / no call parens
// preceded by whitespace-only invocation context) -- both the declaration
// and a call end in the same text `nativeInvalidate()`, but only the
// declaration is preceded by `fun`. Since we already scope to a specific
// function body (which never contains the `external fun` declaration line),
// a plain substring check is safe here.
const CALLS_NATIVE_INVALIDATE = /\bnativeInvalidate\s*\(\s*\)/

describe('KbModule Android lifecycle wiring (back-button wedge guard)', () => {
  const source = fs.readFileSync(kbModulePath, 'utf8')

  it('calls nativeInvalidate() from invalidate() (real TurboModule teardown)', () => {
    const body = extractFunctionBody(source, /override\s+fun\s+invalidate\s*\(\s*\)/)
    expect(CALLS_NATIVE_INVALIDATE.test(body)).toBe(true)
  })

  it('does NOT call nativeInvalidate() from destroy() (Activity death, not instance teardown)', () => {
    const body = extractFunctionBody(source, /(?<!override\s)\bfun\s+destroy\s*\(\s*\)/)
    if (CALLS_NATIVE_INVALIDATE.test(body)) {
      throw new Error(
        'KbModule.destroy() calls nativeInvalidate(). destroy() is only reachable from ' +
          'onHostDestroy, which fires when the last Activity dies while the ReactInstance ' +
          'and TurboModules survive (MainApplication holds the ReactHost in an ' +
          'application-scoped `by lazy`). Nulling the native bridge there permanently wedges ' +
          'RPC: press back to exit to home, reopen the app, and every inbound RPC is silently ' +
          'dropped for the life of the process because nothing ever re-runs the bindings ' +
          'installer that repopulates g_bridge. Move nativeInvalidate() to invalidate() instead ' +
          '(fires on real ReactInstance/TurboModule teardown, e.g. reload).'
      )
    }
  })

  it('does NOT call nativeInvalidate() from the onHostDestroy lifecycle callback', () => {
    const body = extractFunctionBody(source, /override\s+fun\s+onHostDestroy\s*\(\s*\)/)
    if (CALLS_NATIVE_INVALIDATE.test(body)) {
      throw new Error(
        'onHostDestroy() calls nativeInvalidate() directly. onHostDestroy fires on Activity ' +
          'death, not ReactInstance teardown -- see the destroy() test above for the wedge this ' +
          'causes. nativeInvalidate() belongs only in invalidate().'
      )
    }
  })
})
