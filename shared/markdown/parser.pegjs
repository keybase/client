{
  // Instead of encoding all the bad cases into a more complicated regexp lets just add some simple code here
  // Note: We aren't trying to be 100% perfect here, just getting something that works pretty good and pretty quickly
  function flatten (input) {
    const result = []
    let strs = []

    function visit(x) {
      if (Array.isArray(x) ) {
        for (const y of x) {
          if (y) {
            visit(y)
          }
        }
      } else if (typeof x === 'string') {
        strs.push(x)
      } else {
        if (strs.length) {
          result.push(strs.join(''))
          strs = []
        }
        result.push(x)
      }
    }

    visit(input)
    if (strs.length) {
      result.push(strs.join(''))
    }
    return result
  }
}

start
 = BlankLine* WhiteSpace* children:((Line LineTerminatorSequence / NonEndBlankLine)* Line?) BlankLine* WhiteSpace* { return {type: 'markup', children: flatten(children)} }

Line
 = (QuoteBlock / CodeBlock / TextBlock)+

BlankLine
 = children:WhiteSpace* LineTerminatorSequence { return {type: 'text-block', children} }

NonEndBlankLine
 = BlankLine !(BlankLine* WhiteSpace* !.)  // excludes groups of blank lines at the end of the input

// InlineCont and InlineDelimiter are used by instantiations of
// __INLINE_RULE__.

InlineCont
 = !CodeBlock (Text / Emoji / NativeEmoji / EscapedChar / SpecialChar)

InlineDelimiter
 = WhiteSpace / PunctuationMarker

__INLINE_RULE__<TextInline, >

TextBlock
 = children:(TextInline / InlineDelimiter)+ { return {type: 'text-block', children: flatten(children)} }

Ticks1 = "`"
Ticks3 = "```"
EscapeMarker = "\\"
StrikeMarker = "~"
BoldMarker = "*"
ItalicMarker = "_"
EmojiMarker = ":"
QuoteBlockMarker = ">"
MentionMarker = "@"

ValidMentionService = "keybase" / "Keybase"
ClosingMentionMarker = MentionMarker ValidMentionService

// Can mark the beginning of a link
PunctuationMarker = [()[\].,!?]

SpecialChar
 = EscapeMarker / StrikeMarker / MentionMarker / BoldMarker / ItalicMarker / EmojiMarker / QuoteBlockMarker / Ticks1 / PunctuationMarker { return text() }

EscapedChar
 = EscapeMarker char:SpecialChar { return char }

NormalChar
 = !NativeEmojiCharacter !SpecialChar NonBlank { return text() }

Text
 = NormalChar+ { return text() }

// TODO: should coalesce multiple line quotes
QuoteBlock
 = QuoteBlockMarker WhiteSpace* children:(CodeBlock / TextBlock)* LineTerminatorSequence? { return {type: 'quote-block', children: flatten(children)} }

__INLINE_RULE__<BoldInline, !BoldMarker>

Bold
 = BoldMarker !WhiteSpace children:BoldInline BoldMarker !(BoldMarker / NormalChar) { return {type: 'bold', children: flatten(children)} }

__INLINE_RULE__<ItalicInline, !ItalicMarker>

Italic
 = ItalicMarker !WhiteSpace children:ItalicInline ItalicMarker !(ItalicMarker / NormalChar) { return {type: 'italic', children: flatten(children)} }

__INLINE_RULE__<StrikeInline, !StrikeMarker>

Strike
 = StrikeMarker !WhiteSpace children:StrikeInline StrikeMarker !(StrikeMarker / NormalChar) { return {type: 'strike', children: flatten(children)} }

__INLINE_RULE__<MentionInline, !ClosingMentionMarker>

Mention
 = MentionMarker !WhiteSpace children:MentionInline MentionMarker service:ValidMentionService { return {type: 'mention', children: flatten(children), service: service.toLowerCase()} }

CodeBlock
 = Ticks3 LineTerminatorSequence? children:(!Ticks3 .)+ Ticks3 { return {type: 'code-block', children: flatten(children)} }

InlineCode
 = Ticks1 children:(!Ticks1 .)+ Ticks1 { return {type: 'inline-code', children: flatten(children)} }

// Here we use the literal ":" because we want to not match the :foo in ::foo
InsideEmojiMarker
 = !EmojiMarker [a-zA-Z0-9+_-] { return text() }

InsideEmojiTone
 = "::skin-tone-" [1-6] { return text() }

Emoji
 = EmojiMarker children:InsideEmojiMarker+ tone:InsideEmojiTone? EmojiMarker { return {type: 'emoji', children: [text()]} }

NativeEmojiCharacter "unicode emoji"
 = [__EMOJI_CHARACTERS__]

NativeEmoji
 = emoji:(NativeEmojiCharacter+)
 {
   const emojiText = emoji.join('')
   const results = []
   let match
   let idx = 0
   while ((match = emojiExp.exec(emojiText)) !== null) {
     results.push(emojiText.substring(idx, match.index))
     results.push({type: 'native-emoji', children: [emojiIndexByChar[match[0]]]})
     idx = match.index + match[0].length
   }
   results.push(emojiText.substring(idx, emojiText.length))
   return results.filter(Boolean)
 }

LinkChar
 = !(SpecialChar+ (LineTerminatorSequence)) char:NonBlank { return char }

Link 
  = url:( [([]* ("http"i "s"i? ":")? (LinkChar+) ) & {
    let URL = [].concat.apply([], url).join('')
    if (URL.length < 4) { // 4 chars is the shortest a URL can be (i.e. t.co)
      return null
    }

    /* Make sure this is a real TLD */
    const tldMatch = URL.match(tldExp)
    if (tldMatch) {
      const tld = tldMatch[4]
      if (!tlds.includes(tld)) { // tlds is an array of all valid TLDs
        return null
      }
    }
    /* ============ */

    /* 
      From now on we're just deciding what to take off the beginnings / ends 
      and what to keep. We keep track of what we've trimmed in `trailing` and 
      `leading` and add it back in as plaintext at the end
    */

    /* Handle trailing periods etc. */
    const trailingPunctuationMatch = URL.match(/([\.,;:"!?])$/) // Match only after a period (we can't assume end parens aren't intended to be on the path)
    let trailing = ''
    if (trailingPunctuationMatch) { // remove + save trailing punctuation before starting
      trailing = trailingPunctuationMatch[0] + trailing
      URL = URL.substring(0, URL.length - trailing.length)
    }
    /* ============ */

    /* Remove matching brackets */
    let leading = ''
    const puncMap = {
      '(': ')',
      '[': ']',
    }
    while (URL[URL.length - 1] === puncMap[URL[0]] && URL.length > 4) {
      leading += URL[0]
      trailing = URL[URL.length - 1] + trailing
      URL = URL.substring(1, URL.length - 1)
    }
    /* ============ */

    /* Remove all leading punctuation ad-hoc */
    const leadingPunctuationMatch = URL.match(/^([()[\]"']+)/)
    if (leadingPunctuationMatch) { // remove + save leading punctuation before starting
      leading += leadingPunctuationMatch[0]
      URL = URL.substring(leading.length)
    }
    /* ============ */

    /* Remove all trailing punctuation if this is just a TLD (no /) */
    let tldPuncMatch = URL.match(tldPuncExp)
    if (tldPuncMatch) {
      const TLDTrailing = URL.match(/[)\].,;:"']+$/) // We already handled periods etc. in trailingPunctuationMatch (we can assume end parens aren't intended to be on a bare TLD)
      const addTrailing = TLDTrailing ? TLDTrailing[0] : ''
      trailing = addTrailing + trailing
      URL = URL.substring(0, URL.length - addTrailing.length)
    }
    /* ============ */

    const matches = linkExp.exec(URL)
    url._data = {leading: leading, matches: matches, trailing: trailing, URL: URL}
    return matches
  } {
    const leading = url._data.leading
    const matches = url._data.matches
    const trailing = url._data.trailing
    const URL = url._data.URL
    delete url._data
    let href = matches[0]
    if (!(href.toLowerCase().startsWith('http://') || href.toLowerCase().startsWith('https://'))) {
      href = 'http://' + href
    }
    return [leading, {type: 'link', href, children: [URL]}, trailing]
  }

NonBlank
 = !(WhiteSpace / LineTerminatorSequence) char:. { return char }

WhiteSpace
 = [\t\v\f \u00A0\uFEFF] / Space

LineTerminatorSequence "end of line"
 = (
   "\n"
   / "\r\n"
   / "\r"
   / "\u2028" // line separator
   / "\u2029" // paragraph separator
 ) { /* consume */ }

Space
 = [\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]
