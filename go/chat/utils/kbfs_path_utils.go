package utils

import (
	"context"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

const usernameRE = `(?:[a-zA-Z0-9]+_?)+` // from go/kbun/username.go

var kbfsPathOuterRegExp = func() *regexp.Regexp {
	const slashDivided = `(?:(?:/keybase|/Volumes/Keybase\\ \(` + usernameRE + `\)|/Volumes/Keybase)((?:\\ |\S)*))`
	const slashDividedQuoted = `"(?:(?:/keybase|/Volumes/Keybase \(` + usernameRE + `\)|/Volumes/Keybase)(.*))"`
	const windows = `(?:(?:K:|k:)(\\\S*))` // don't support escape on windows
	const windowsQuoted = `"(?:(?:K:|k:)(\\.*))"`
	const deeplink = `(?:(?:keybase:/)((?:\S)*))`
	return regexp.MustCompile(`(?:[^\w"]|^)(` + slashDivided + "|" + slashDividedQuoted + "|" + windows + "|" + windowsQuoted + "|" + deeplink + `)`)
}()

var kbfsPathInnerRegExp = func() *regexp.Regexp {
	const socialAssertion = `[-_a-zA-Z0-9.]+@[a-zA-Z.]+`
	const user = `(?:(?:` + usernameRE + `)|(?:` + socialAssertion + `))`
	const usernames = user + `(?:,` + user + `)*`
	const teamName = usernameRE + `(?:\.` + usernameRE + `)*`
	const tlfType = "/(?:private|public|team)$"
	const tlf = "/(?:(?:private|public)/" + usernames + "(?:#" + usernames + ")?|team/" + teamName + `)(?:/|$)`
	const specialFiles = "/(?:.kbfs_.+)"
	return regexp.MustCompile(`^(?:(?:` + tlf + `)|(?:` + tlfType + `)|(?:` + specialFiles + `))`)
}()

type outerMatch struct {
	matchStartIndex int
	wholeMatch      string
	afterKeybase    string
}

func (m *outerMatch) isKBFSPath() bool {
	return m.matchStartIndex >= 0 && (len(m.afterKeybase) == 0 || kbfsPathInnerRegExp.MatchString(m.afterKeybase))
}
func (m *outerMatch) rebasedPath() string {
	return "/keybase" + m.afterKeybase
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
				wholeMatch:      body[indices[2]:indices[3]],
				afterKeybase: strings.TrimRight(
					strings.ReplaceAll(
						strings.ReplaceAll(
							body[indices[4]:indices[5]],
							`\\`,
							`\`,
						),
						`\ `,
						` `,
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
				wholeMatch:      body[indices[2]:indices[3]],
				afterKeybase: strings.TrimRight(
					strings.ReplaceAll(
						body[indices[8]:indices[9]],
						`\`,
						`/`,
					),
					"/",
				),
			})
		case indices[10] > 0:
			outerMatches = append(outerMatches, outerMatch{
				matchStartIndex: indices[2],
				wholeMatch:      body[indices[2]:indices[3]],
				afterKeybase: strings.TrimRight(
					strings.ReplaceAll(
						body[indices[10]:indices[11]],
						`\`,
						`/`,
					),
					"/",
				),
			})
		case indices[12] > 0:
			unescaped, err := url.PathUnescape(body[indices[12]:indices[13]])
			if err != nil {
				continue
			}
			outerMatches = append(outerMatches, outerMatch{
				matchStartIndex: indices[2],
				wholeMatch:      body[indices[2]:indices[3]],
				afterKeybase: strings.TrimRight(
					unescaped,
					"/",
				),
			})
		}
	}
	return outerMatches
}

func ParseKBFSPaths(ctx context.Context, g *libkb.GlobalContext, body string) (paths []chat1.KBFSPath) {
	outerMatches := matchKBFSPathOuter(body)
	for _, match := range outerMatches {
		if match.isKBFSPath() {
			paths = append(paths,
				chat1.KBFSPath{
					Index:        match.matchStartIndex,
					RawPath:      match.wholeMatch,
					RebasedPath:  match.rebasedPath(),
					PlatformPath: "",
				})
		}
	}
	return paths
}
