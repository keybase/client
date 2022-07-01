package utils

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func strPointer(str string) *string { return &str }
func makeKBFSPathForTest(rawPath string, standardPath *string) chat1.KBFSPath {
	if standardPath == nil {
		return chat1.KBFSPath{RawPath: rawPath, StandardPath: rawPath}
	}
	return chat1.KBFSPath{RawPath: rawPath, StandardPath: *standardPath}
}

var kbfsPathTests = map[string]chat1.KBFSPath{
	"/keybase ha":                            makeKBFSPathForTest("/keybase", nil),
	"/keybase/哟":                             {},
	"before/keybase":                         {},
	"之前/keybase":                             makeKBFSPathForTest("/keybase", nil),
	"/keybase/public":                        makeKBFSPathForTest("/keybase/public", nil),
	"/keybase/team":                          makeKBFSPathForTest("/keybase/team", nil),
	"/keybase/private/":                      makeKBFSPathForTest("/keybase/private/", strPointer("/keybase/private")),
	"/keybase/team/keybase":                  makeKBFSPathForTest("/keybase/team/keybase", nil),
	"/keybase/team/keybase/blahblah":         makeKBFSPathForTest("/keybase/team/keybase/blahblah", nil),
	`/keybase/team/keybase/blah\ blah\ blah`: makeKBFSPathForTest(`/keybase/team/keybase/blah\ blah\ blah`, strPointer("/keybase/team/keybase/blah blah blah")),
	`/keybase/team/keybase/blah\\blah\\blah`: makeKBFSPathForTest(`/keybase/team/keybase/blah\\blah\\blah`, strPointer(`/keybase/team/keybase/blah\blah\blah`)),
	"/keybase/team/keybase/blahblah/":        makeKBFSPathForTest("/keybase/team/keybase/blahblah/", strPointer("/keybase/team/keybase/blahblah")),
	"/keybase/private/songgao/🍻":             makeKBFSPathForTest("/keybase/private/songgao/🍻", nil),
	"/keybase/private/songgao/🍻/🍹.png/":      makeKBFSPathForTest("/keybase/private/songgao/🍻/🍹.png/", strPointer("/keybase/private/songgao/🍻/🍹.png")),
	"/keybase/private/songgao/囧/yo":          makeKBFSPathForTest("/keybase/private/songgao/囧/yo", nil),
	"/keybase/team/keybase,blah":             {},
	"/keybase/team/keybase.blah":             makeKBFSPathForTest("/keybase/team/keybase.blah", nil),
	"/keybaseprivate":                        {},
	"/keybaseprivate/team":                   {},
	"/keybase/teamaa/keybase":                {},
	"/keybase/.kbfs_status":                  makeKBFSPathForTest("/keybase/.kbfs_status", nil),
	"/foo":                                   {},

	"/keybase/private/songgao,strib#jzila/file":                                                                   makeKBFSPathForTest("/keybase/private/songgao,strib#jzila/file", nil),
	"/keybase/private/song-gao,strib#jzila/file":                                                                  {},
	"/keybase/private/songgao,strib#jzila,jakob223/file":                                                          makeKBFSPathForTest("/keybase/private/songgao,strib#jzila,jakob223/file", nil),
	"/keybase/private/__songgao__@twitter,strib@github,jzila@reddit,jakob.weisbl.at@dns/file":                     makeKBFSPathForTest("/keybase/private/__songgao__@twitter,strib@github,jzila@reddit,jakob.weisbl.at@dns/file", nil),
	`"/keybase/private/songgao,kbpbot_staging,songgao_test (files before songgao_test account reset 2019-05-10)"`: makeKBFSPathForTest(`"/keybase/private/songgao,kbpbot_staging,songgao_test (files before songgao_test account reset 2019-05-10)"`, strPointer("/keybase/private/songgao,kbpbot_staging,songgao_test (files before songgao_test account reset 2019-05-10)")),
	"/keybase/private/songgao,[meatball+keybase@gao.io]@email":                                                    makeKBFSPathForTest("/keybase/private/songgao,[meatball+keybase@gao.io]@email", strPointer("/keybase/private/songgao,[meatball+keybase@gao.io]@email")),

	"keybase://team/keybase/blahblah":                               makeKBFSPathForTest("keybase://team/keybase/blahblah", strPointer("/keybase/team/keybase/blahblah")),
	"keybase://private/foo/blahblah":                                makeKBFSPathForTest("keybase://private/foo/blahblah", strPointer("/keybase/private/foo/blahblah")),
	"keybase://public/foo/blahblah":                                 makeKBFSPathForTest("keybase://public/foo/blahblah", strPointer("/keybase/public/foo/blahblah")),
	"keybase://public/foo/blah%20blah":                              makeKBFSPathForTest("keybase://public/foo/blah%20blah", strPointer("/keybase/public/foo/blah blah")),
	"keybase://chat/blah":                                           {},
	"keybase://private/songgao,[meatball+keybase@gao.io]@email/abc": makeKBFSPathForTest("keybase://private/songgao,[meatball+keybase@gao.io]@email/abc", strPointer("/keybase/private/songgao,[meatball+keybase@gao.io]@email/abc")),

	"/Volumes/Keybase/team/keybase/blahblah":             makeKBFSPathForTest("/Volumes/Keybase/team/keybase/blahblah", strPointer("/keybase/team/keybase/blahblah")),
	"/Volumes/Keybase/private/foo/blahblah":              makeKBFSPathForTest("/Volumes/Keybase/private/foo/blahblah", strPointer("/keybase/private/foo/blahblah")),
	"/Volumes/Keybase/public/foo/blahblah":               makeKBFSPathForTest("/Volumes/Keybase/public/foo/blahblah", strPointer("/keybase/public/foo/blahblah")),
	`/Volumes/Keybase\ (meatball)/team/keybase/blahblah`: makeKBFSPathForTest(`/Volumes/Keybase\ (meatball)/team/keybase/blahblah`, strPointer("/keybase/team/keybase/blahblah")),
	`/Volumes/Keybase\ (meatball)/private/foo/blahblah`:  makeKBFSPathForTest(`/Volumes/Keybase\ (meatball)/private/foo/blahblah`, strPointer("/keybase/private/foo/blahblah")),
	`/Volumes/Keybase\ (meatball)/public/foo/blahblah`:   makeKBFSPathForTest(`/Volumes/Keybase\ (meatball)/public/foo/blahblah`, strPointer("/keybase/public/foo/blahblah")),
	`"/Volumes/Keybase (meatball)/public/foo/blahblah"`:  makeKBFSPathForTest(`"/Volumes/Keybase (meatball)/public/foo/blahblah"`, strPointer("/keybase/public/foo/blahblah")),

	`K:\team\keybase\blahblah`:        makeKBFSPathForTest(`K:\team\keybase\blahblah`, strPointer("/keybase/team/keybase/blahblah")),
	`K:\private\foo\blahblah`:         makeKBFSPathForTest(`K:\private\foo\blahblah`, strPointer("/keybase/private/foo/blahblah")),
	`k:\public\foo\blahblah`:          makeKBFSPathForTest(`k:\public\foo\blahblah`, strPointer("/keybase/public/foo/blahblah")),
	`K:\public\foo\blahblah lalala`:   makeKBFSPathForTest(`K:\public\foo\blahblah`, strPointer("/keybase/public/foo/blahblah")),
	`"K:\public\foo\blahblah lalala"`: makeKBFSPathForTest(`"K:\public\foo\blahblah lalala"`, strPointer("/keybase/public/foo/blahblah lalala")),

	"/keybase.":                        makeKBFSPathForTest("/keybase", nil),
	"/keybase/team.":                   makeKBFSPathForTest("/keybase/team", nil),
	"/keybase/team/keybase/blahblah.":  makeKBFSPathForTest("/keybase/team/keybase/blahblah", nil),
	`K:\team\keybase\blahblah.`:        makeKBFSPathForTest(`K:\team\keybase\blahblah`, strPointer("/keybase/team/keybase/blahblah")),
	"keybase://team/keybase/blahblah.": makeKBFSPathForTest("keybase://team/keybase/blahblah", strPointer("/keybase/team/keybase/blahblah")),

	"/keybase？":                        makeKBFSPathForTest("/keybase", nil),
	"/keybase/team？":                   makeKBFSPathForTest("/keybase/team", nil),
	"/keybase/team/keybase/blahblah？":  makeKBFSPathForTest("/keybase/team/keybase/blahblah", nil),
	`K:\team\keybase\blahblah？`:        makeKBFSPathForTest(`K:\team\keybase\blahblah`, strPointer("/keybase/team/keybase/blahblah")),
	"keybase://team/keybase/blahblah？": makeKBFSPathForTest("keybase://team/keybase/blahblah", strPointer("/keybase/team/keybase/blahblah")),

	`"/keybase/team/keybase/blahblah."`: makeKBFSPathForTest(`"/keybase/team/keybase/blahblah."`, strPointer("/keybase/team/keybase/blahblah.")),
	`"K:\team\keybase\blahblah."`:       makeKBFSPathForTest(`"K:\team\keybase\blahblah."`, strPointer("/keybase/team/keybase/blahblah.")),

	`"/keybase/team/keybase (local conflicted copy 2019-10-24 #2)"`: makeKBFSPathForTest(`"/keybase/team/keybase (local conflicted copy 2019-10-24 #2)"`, strPointer("/keybase/team/keybase (local conflicted copy 2019-10-24 #2)")),
}

func TestParseKBFSPathMatches(t *testing.T) {
	for input, expected := range kbfsPathTests {
		paths := ParseKBFSPaths(context.Background(), input)
		if len(expected.RawPath) > 0 {
			require.Len(t, paths, 1, "error matching: %s", input)
			require.Equal(t, expected.RawPath, paths[0].RawPath, "wrong RawPath %q", input)
			require.Equal(t, expected.StandardPath, paths[0].StandardPath, "wrong RebasePath %q", input)
		} else {
			require.Len(t, paths, 0, "unexpected match: %s", input)
		}
	}
}

func TestParseKBFSPathDetailed(t *testing.T) {
	for _, input := range []string{
		`this is a kbfs path /keybase/team/keybase/blah\ blah\ blah`,
		`this is a kbfs path "K:\team\keybase\blah blah blah"`,
	} {
		paths := ParseKBFSPaths(context.Background(), input)
		require.Len(t, paths, 1, "input: %s", input)
		require.Equal(t, 20, paths[0].StartIndex, "input: %s", input)
		require.Equal(t, "/keybase/team/keybase/blah blah blah", paths[0].StandardPath, "input: %s", input)
		require.Equal(t, "keybase://team/keybase/blah%20blah%20blah", paths[0].PathInfo.DeeplinkPath, "input: %s", input)
		if libkb.RuntimeGroup() == keybase1.RuntimeGroup_WINDOWSLIKE {
			require.Equal(t, `\team\keybase\blah blah blah`, paths[0].PathInfo.PlatformAfterMountPath, "input: %s", input)
		} else {
			require.Equal(t, "/team/keybase/blah blah blah", paths[0].PathInfo.PlatformAfterMountPath, "input: %s", input)
		}
	}

	withSuffix := `"/keybase/private/songgao,kbpbot_staging,songgao_test (files before songgao_test account reset 2019-05-10)"`
	paths := ParseKBFSPaths(context.Background(), withSuffix)
	require.Len(t, paths, 1, "input: %s", withSuffix)
	require.Equal(t, "keybase://private/songgao%2Ckbpbot_staging%2Csonggao_test%20%28files%20before%20songgao_test%20account%20reset%202019-05-10%29", paths[0].PathInfo.DeeplinkPath)
}
