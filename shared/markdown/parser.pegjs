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

TextBlock
 = children:(__INLINE_MACRO__<> / InlineDelimiter)+ { return {type: 'text-block', children: flatten(children)} }

InlineStart
 = InlineCode / Italic / Bold / Link / Mention / Strike / InlineCont

InlineCont
 = !CodeBlock (Text / Emoji / EscapedChar / NativeEmoji / SpecialChar)

InlineDelimiter
 = WhiteSpace / PunctuationMarker

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

Bold
 = BoldMarker !WhiteSpace children:__INLINE_MACRO__<!BoldMarker> BoldMarker { return {type: 'bold', children: flatten(children)} }

Italic
 = ItalicMarker !WhiteSpace children:__INLINE_MACRO__<!ItalicMarker> ItalicMarker { return {type: 'italic', children: flatten(children)} }

Strike
 = StrikeMarker !WhiteSpace children:__INLINE_MACRO__<!StrikeMarker> StrikeMarker { return {type: 'strike', children: flatten(children)} }

Mention
 = MentionMarker !WhiteSpace children:__INLINE_MACRO__<!ClosingMentionMarker> MentionMarker service:ValidMentionService { return {type: 'mention', children: flatten(children), service: service.toLowerCase()} }

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
 = !(SpecialChar+ (LineTerminatorSequence / !.)) char:NonBlank { return char }

Link
 = proto:("http"i "s"i? ":")? url:(LinkChar+) & {
     const Url = url.join('')
     const fullUrl = proto ? proto.join('') + Url : Url
     const matches = linkExp.exec(fullUrl)
     if (!matches) {
       return false
     }
     let match
     const firstMatch = matches[0]
     const firstChar = firstMatch.substring(0,1)
     const alphasExp = /^[a-z]$/i
     if (!alphasExp.exec(firstChar)) {
       match = matches[3]
     } else {
       match = matches[0]
     }
     url._match = match  // save the match via expando property (used below)
     return match
   }
 {
   const match = url._match
   delete url._match
   const urlText = url.join('')
   const protoText = proto ? proto.join('') : ''
   const href = protoText ? match : 'http://' + match
   let text = protoText + urlText
   let delims = urlText.split(match)
   delims = delims.length > 1 ? delims : ["", ""] // Detect if the substring op failed
   text = delims.length > 1 ? match : text
   return [
     delims[0],
     {type: 'link', href, children: [text]},
     delims[1],
   ]
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
