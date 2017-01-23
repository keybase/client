{
  const linkExp = new RegExp(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)\b/, 'gi')
  // Instead of encoding all the bad cases into a more complicated regexp lets just add some simple code here
  // Note: We aren't trying to be 100% perfect here, just getting something that works pretty good and pretty quickly
  function goodLink (link) {
    if (link.includes('..'))
      return false
        return true
  }

  function convertLink (text) {
    const matches = text.match(linkExp)
      if (matches && goodLink(matches[0])) {
        const match = matches[0]
          const rest = text.substring(match.length)
          if (rest) {
            return {
type: 'text',
        children: [
        {type: 'link', children: [match]},
        rest
        ]
            }
          } else {
            return {type: 'link', children: [match]}
          }
      } else {
        return text
      }
  }
}

start
 = children:(Blank / Code / Content / Blank)* { return {type: 'text', children}; }

Code = CodeBlock / InlineCode

Content
 = StyledText / Text

StyledText
 = QuoteBlock / Italic / Bold / Strike / Emoji

// Define what our markers look like
Ticks1 = "`" ! '`'
Ticks3 = __? "```" __? ! '```'

StrikeMarker = "~" ! "~"
BoldMarker = "*" ! "*"
ItalicMarker = "_" ! "_"
EmojiMarker = ":" ! ":"
QuoteBlockMarker = ">"

// Define what we can go to when we are inside a style. e.g. Bold -> Bold doesn't make sense, but Bold -> Strike does
FromBold
 = (Italic / Strike / InsideBoldMarker)

FromItalic
 = Bold / Strike / InsideItalicMarker

FromStrike
 = Italic / Bold / InsideStrikeMarker

FromQuote
 = Italic / Bold / Strike / InsideQuoteBlock

// Define what text inside a style looks like. Usually everything but the end marker
InsideBoldMarker
 = (! BoldMarker .) { return text(); }

InsideItalicMarker
 = ((! ItalicMarker) .) { return text(); }

InsideStrikeMarker
 = ((! StrikeMarker) .) { return text(); }

InsideCodeBlock
 = ((! Ticks3) .) { return text(); }

InsideInlineCode
 = ((! Ticks1) .) { return text(); }

InsideQuoteBlock
 = ((! LineTerminatorSequence) .) { return text(); }

// Here we use the literal ":" because we want to not match the :foo in ::foo
InsideEmojiMarker
 = (! ":" [a-z-_]) { return text(); }

InsideEmojiTone
 = "::skin-tone-" [1-6] { return text(); }

// Define the rules for styles. Usually a start marker, children, and an end marker.
QuoteBlock
 = QuoteBlockMarker _? children:FromQuote* LineTerminatorSequence { return {type: 'quote-block', children}; }

Bold
 = BoldMarker children:FromBold* BoldMarker { return {type: 'bold', children}; }

Italic
 = ItalicMarker children:FromItalic* ItalicMarker { return {type: 'italic', children}; }

Strike
 = StrikeMarker children:FromStrike* StrikeMarker { return {type: 'strike', children}; }

CodeBlock
 = Ticks3 children:InsideCodeBlock* Ticks3 { return {type: 'code-block', children}; }

InlineCode
 = Ticks1 children:InsideInlineCode* Ticks1 { return {type: 'inline-code', children}; }

Emoji
 = EmojiMarker children:InsideEmojiMarker+ tone:InsideEmojiTone? ":" { return {type: 'emoji', children: [children.join('') + (tone || '')]}; }

Text "text"
 = _? NonBlank+ _? {
    return convertLink(text())
 }

// Useful helpers

Blank
  = ws:(WhiteSpace / LineTerminatorSequence) {
      return ws;
    }

NonBlank
  = !(WhiteSpace / LineTerminatorSequence) char:. {
      return char;
    }
_
  = (WhiteSpace)*

__
  = (WhiteSpace / LineTerminatorSequence)*

WhiteSpace
  = [\t\v\f \u00A0\uFEFF] / Space

LineTerminatorSequence "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028" // line spearator
  / "\u2029" // paragraph separator

Space
  = [\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]
