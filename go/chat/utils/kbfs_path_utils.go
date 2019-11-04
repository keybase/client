package utils

import (
	"context"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

const localUsernameRE = "(?:[a-zA-A0-0_]+-?)+"

var kbfsPathOuterRegExp = func() *regexp.Regexp {
	const slashDivided = `(?:(?:/keybase|/Volumes/Keybase\\ \(` + kbun.UsernameRE + `\)|/Volumes/Keybase)((?:\\ |\S)*))`
	const slashDividedQuoted = `"(?:(?:/keybase|/Volumes/Keybase \(` + localUsernameRE + `\)|/Volumes/Keybase)(.*))"`
	const windows = `(?:(?:K:|k:)(\\\S*))` // don't support escape on windows
	// TODO if in the future we want to support custom mount points we can
	// probably tap into Env() to get it.
	const windowsQuoted = `"(?:(?:K:|k:)(\\.*))"`
	const deeplink = `(?:(?:keybase:/)((?:\S)*))`
	return regexp.MustCompile(`(?:[^\w"]|^)(` + slashDivided + "|" + slashDividedQuoted + "|" + windows + "|" + windowsQuoted + "|" + deeplink + `)`)
}()

type outerMatch struct {
	matchStartIndex int
	wholeMatch      string
	afterKeybase    string
}

func (m *outerMatch) isKBFSPath() bool {
	return m.matchStartIndex >= 0 && libkb.IsKBFSAfterKeybasePath(m.afterKeybase)
}

func (m *outerMatch) standardPath() string {
	return "/keybase" + m.afterKeybase
}

func unquotedTrailingTrimFuncWindows(r rune) bool {
	return r != '\\' && unicode.IsPunct(r)
}
func unquotedTrailingTrimFuncUnix(r rune) bool {
	return r != '/' && unicode.IsPunct(r)
}

func matchKBFSPathOuter(body string) (outerMatches []outerMatch) {
	res := kbfsPathOuterRegExp.FindAllStringSubmatchIndex(body, -1)
	for _, indices := range res {
		// 2:3 match
		// 4:5 slash-divided inside /keybase
		// 6:7 quoted slash-divided inside /keybase
		// 8:9 windows inside /keybase
		// 10:11 quoted windows inside /keybase
		// 12:13 deeplink after "keybase:/"
		if len(indices) != 14 {
			panic("bad regexp: len(indices): " + strconv.Itoa(len(indices)))
		}
		switch {
		case indices[4] > 0:
			outerMatches = append(outerMatches, outerMatch{
				matchStartIndex: indices[2],
				wholeMatch:      strings.TrimRightFunc(body[indices[2]:indices[3]], unquotedTrailingTrimFuncUnix),
				afterKeybase: strings.TrimRight(
					strings.Replace(
						strings.Replace(
							strings.TrimRightFunc(body[indices[4]:indices[5]], unquotedTrailingTrimFuncUnix),
							`\\`,
							`\`,
							-1,
						),
						`\ `,
						` `,
						-1,
					),
					"/",
				),
			})
		case indices[6] > 0:
			outerMatches = append(outerMatches, outerMatch{
				matchStartIndex: indices[2],
				wholeMatch:      body[indices[2]:indices[3]],
				afterKeybase: strings.TrimRight(
					body[indices[6]:indices[7]],
					"/",
				),
			})
		case indices[8] > 0:
			outerMatches = append(outerMatches, outerMatch{
				matchStartIndex: indices[2],
				wholeMatch:      strings.TrimRightFunc(body[indices[2]:indices[3]], unquotedTrailingTrimFuncWindows),
				afterKeybase: strings.TrimRight(
					strings.Replace(
						strings.TrimRightFunc(body[indices[8]:indices[9]], unquotedTrailingTrimFuncWindows),
						`\`,
						`/`,
						-1,
					),
					"/",
				),
			})
		case indices[10] > 0:
			outerMatches = append(outerMatches, outerMatch{
				matchStartIndex: indices[2],
				wholeMatch:      body[indices[2]:indices[3]],
				afterKeybase: strings.TrimRight(
					strings.Replace(
						body[indices[10]:indices[11]],
						`\`,
						`/`,
						-1,
					),
					"/",
				),
			})
		case indices[12] > 0:
			unescaped, err := url.PathUnescape(strings.TrimRightFunc(body[indices[12]:indices[13]], unquotedTrailingTrimFuncUnix))
			if err != nil {
				continue
			}
			outerMatches = append(outerMatches, outerMatch{
				matchStartIndex: indices[2],
				wholeMatch:      strings.TrimRightFunc(body[indices[2]:indices[3]], unquotedTrailingTrimFuncUnix),
				afterKeybase: strings.TrimRight(
					unescaped,
					"/",
				),
			})
		}
	}
	return outerMatches
}

func ParseKBFSPaths(ctx context.Context, body string) (paths []chat1.KBFSPath) {
	outerMatches := matchKBFSPathOuter(ReplaceQuotedSubstrings(body, true))
	for _, match := range outerMatches {
		if match.isKBFSPath() {
			kbfsPathInfo, err := libkb.GetKBFSPathInfo(match.standardPath())
			if err != nil {
				continue
			}
			paths = append(paths,
				chat1.KBFSPath{
					StartIndex:   match.matchStartIndex,
					RawPath:      match.wholeMatch,
					StandardPath: match.standardPath(),
					PathInfo:     kbfsPathInfo,
				})
		}
	}
	return paths
}

func DecorateWithKBFSPath(
	ctx context.Context, body string, paths []chat1.KBFSPath) (
	res string) {
	var offset, added int
	for _, path := range paths {
		body, added = DecorateBody(ctx, body, path.StartIndex+offset, len(path.RawPath), chat1.NewUITextDecorationWithKbfspath(path))
		offset += added
	}
	return body
}
