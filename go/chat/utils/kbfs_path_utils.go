import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func getKBFSPathRegExpComponents(isWindows bool) (keybase, tlf, inTlf, tlfType, specialFiles, slash string) {
	var escape string
	slash, escape = "/", `\\`
	if isWindows {
		slash, escape = `\\`, `\^`
	}
	username := `(?:[a-zA-Z0-9]+_?)+` // from go/kbun/username.go
	socialAssertion := `[-_a-zA-Z0-9.]+@[a-zA-Z.]+`
	user := `(?:(?:` + username + `)|(?:` + socialAssertion + `))`
	usernames := user + `(?:,` + user + `)*`
	teamName := username + `(?:\.` + username + `)*`
	tlfType = slash + "(?:private|public|team)"
	tlf = slash + "(?:(?:private|public)" + slash + usernames + "(?:#" + usernames + ")?|team" + slash + teamName + `)`
	inTlf = slash + "(?:" + escape + escape + "|" + escape + ` |\S)+`
	specialFiles = slash + "(?:.kbfs_.+)"
	keybase = `(?:/keybase|keybase:/|/Volumes/Keybase|/Volumes/Keybase\\ \(` + username + `\))`
	if isWindows {
		keybase = `(?:K:|k:)`
	}
	return
}

var kbfsPathRegExp = func() *regexp.Regexp {
	keybase, tlf, inTlf, tlfType, specialFiles, slash := getKBFSPathRegExpComponents(false)
	unixRegExp := `(?:` + keybase + `((?:` + tlf + `(?:` + inTlf + `)?)|(?:` + tlfType + `)|(?:` + specialFiles + `))?` + slash + `?)`
	keybase, tlf, inTlf, tlfType, specialFiles, slash = getKBFSPathRegExpComponents(true)
	windowsRegExp := `(?:` + keybase + `((?:` + tlf + `(?:` + inTlf + `)?)|(?:` + tlfType + `)|(?:` + specialFiles + `))?` + slash + `?)`
	return regexp.MustCompile(`(?:\W|^)(` + unixRegExp + "|" + windowsRegExp + `)(?:\s|$)`)
}()

func postprocessMatchedPath(isWindows bool, matchedRawPath string, matchedAfterKeybasePath string) processedKBFSPath {
	fmt.Printf("postprocessMatchedPath isWindows=%v matchedRawPath=%v matchedAfterKeybasePath=%v\n", isWindows, matchedRawPath, matchedAfterKeybasePath)
	var rawPath, matchedAfterKeybasePathUnified string
	if isWindows {
		rawPath = strings.TrimRight(matchedRawPath, "\\")
		matchedAfterKeybasePathUnified = strings.TrimRight(
			strings.ReplaceAll(
				strings.ReplaceAll(
					strings.ReplaceAll(
						matchedAfterKeybasePath,
						"^^",
						"^",
					),
					"^ ",
					" ",
				),
				`\`,
				`/`,
			),
			"/",
		)
	} else {
		rawPath = strings.TrimRight(matchedRawPath, "/")
		matchedAfterKeybasePathUnified = strings.TrimRight(
			strings.ReplaceAll(
				strings.ReplaceAll(
					matchedAfterKeybasePath,
					`\\`,
					`\`,
				),
				`\ `,
				" ",
			),
			"/",
		)
	}
	return processedKBFSPath{
		rawPath:                        rawPath,
		matchedAfterKeybasePathUnified: matchedAfterKeybasePathUnified,
	}
}

type processedKBFSPath struct {
	rawPath                        string
	matchedAfterKeybasePathUnified string
}

func (p processedKBFSPath) rebasedPath() string {
	return "/keybase" + p.matchedAfterKeybasePathUnified
}

func (p processedKBFSPath) getPlatformPath(g *libkb.GlobalContext) string {
	mountDir := g.Env.GetMountDir()
	if libkb.RuntimeGroup() == keybase1.RuntimeGroup_WINDOWSLIKE {
		return mountDir +
			strings.ReplaceAll(
				p.matchedAfterKeybasePathUnified,
				"/",
				`\`,
			)
	}
	return mountDir + p.matchedAfterKeybasePathUnified
}

func makeKBFSPath(g *libkb.GlobalContext, index int, processedPath processedKBFSPath) chat1.KBFSPath {
	return chat1.KBFSPath{
		Index:        index,
		RawPath:      processedPath.rawPath,
		RebasedPath:  processedPath.rebasedPath(),
		PlatformPath: processedPath.getPlatformPath(g),
	}
}

func ParseKBFSPaths(ctx context.Context, g *libkb.GlobalContext, body string) (paths []chat1.KBFSPath) {
	body = ReplaceQuotedSubstrings(body, false)
	allIndexMatches := kbfsPathRegExp.FindAllStringSubmatchIndex(body, -1)
	fmt.Printf("input: %s\nmatches: %v\n\n", body, allIndexMatches)
	for _, matches := range allIndexMatches {
		if len(matches) != 8 {
			continue
		}
		rawPath := body[matches[2]:matches[3]]
		var matchedAfterKeybasePath string
		var isWindows bool
		if matches[4] > 0 && matches[5] > 0 {
			matchedAfterKeybasePath = body[matches[4]:matches[5]]
			isWindows = false
		} else if matches[6] > 0 && matches[7] > 0 {
			matchedAfterKeybasePath = body[matches[6]:matches[7]]
			isWindows = true
		} else {
			matchedAfterKeybasePath = ""
		}
		processedPath := postprocessMatchedPath(isWindows, rawPath, matchedAfterKeybasePath)
		paths = append(paths, makeKBFSPath(g, matches[2], processedPath))
	}
	return paths
}

