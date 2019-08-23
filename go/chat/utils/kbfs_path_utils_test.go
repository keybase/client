package utils

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func strPointer(str string) *string { return &str }
func makeKBFSPathForTest(rawPath string, rebasedPath *string) chat1.KBFSPath {
	if rebasedPath == nil {
		return chat1.KBFSPath{RawPath: rawPath, RebasedPath: rawPath}
	}
	return chat1.KBFSPath{RawPath: rawPath, RebasedPath: *rebasedPath}
}

var kbfsPathTests = map[string]chat1.KBFSPath{
	"/keybase ha":                            makeKBFSPathForTest("/keybase", nil),
	"/keybase/哟":                             chat1.KBFSPath{},
	"before/keybase":                         chat1.KBFSPath{},
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
	"/keybase/team/keybase,blah":             chat1.KBFSPath{},
	"/keybase/team/keybase.blah":             makeKBFSPathForTest("/keybase/team/keybase.blah", nil),
	"/keybaseprivate":                        chat1.KBFSPath{},
	"/keybaseprivate/team":                   chat1.KBFSPath{},
	"/keybase/teamaa/keybase":                chat1.KBFSPath{},
	"/keybase/.kbfs_status":                  makeKBFSPathForTest("/keybase/.kbfs_status", nil),
	"/foo":                                   chat1.KBFSPath{},
	"/keybase.":                              chat1.KBFSPath{},

	"/keybase/private/songgao,strib#jzila/file":                                               makeKBFSPathForTest("/keybase/private/songgao,strib#jzila/file", nil),
	"/keybase/private/song-gao,strib#jzila/file":                                              chat1.KBFSPath{},
	"/keybase/private/songgao,strib#jzila,jakob223/file":                                      makeKBFSPathForTest("/keybase/private/songgao,strib#jzila,jakob223/file", nil),
	"/keybase/private/__songgao__@twitter,strib@github,jzila@reddit,jakob.weisbl.at@dns/file": makeKBFSPathForTest("/keybase/private/__songgao__@twitter,strib@github,jzila@reddit,jakob.weisbl.at@dns/file", nil),

	"keybase://team/keybase/blahblah":  makeKBFSPathForTest("keybase://team/keybase/blahblah", strPointer("/keybase/team/keybase/blahblah")),
	"keybase://private/foo/blahblah":   makeKBFSPathForTest("keybase://private/foo/blahblah", strPointer("/keybase/private/foo/blahblah")),
	"keybase://public/foo/blahblah":    makeKBFSPathForTest("keybase://public/foo/blahblah", strPointer("/keybase/public/foo/blahblah")),
	"keybase://public/foo/blah%20blah": makeKBFSPathForTest("keybase://public/foo/blah%20blah", strPointer("/keybase/public/foo/blah blah")),
	"keybase://chat/blah":              chat1.KBFSPath{},

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
}

func TestParseKBFSPathMatches(t *testing.T) {
	for input, expected := range kbfsPathTests {
		paths := ParseKBFSPaths(context.Background(), nil, input)
		if len(expected.RawPath) > 0 {
			require.Len(t, paths, 1, "error matching: %s", input)
			require.Equal(t, expected.RawPath, paths[0].RawPath, "wrong RawPath %q", input)
			require.Equal(t, expected.RebasedPath, paths[0].RebasedPath, "wrong RebasePath %q", input)
		} else {
			require.Len(t, paths, 0, "unexpected match: %s", input)
		}
	}
}
