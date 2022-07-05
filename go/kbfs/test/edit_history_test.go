// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

func TestEditHistorySimple(t *testing.T) {
	// Bob writes one file.
	expectedEdits1 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"bob",
			[]string{"/keybase/private/alice,bob/a/b"},
			nil,
		},
	}
	// Alice writes one file.
	expectedEdits2 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"alice",
			[]string{"/keybase/private/alice,bob/a/c"},
			nil,
		},
		expectedEdits1[0],
	}
	// Bob overwrites his first file.
	expectedEdits3 := []expectedEdit{
		expectedEdits1[0],
		expectedEdits2[0],
	}
	// Alice deletes the file she wrote.
	expectedEdits4 := []expectedEdit{
		expectedEdits3[0],
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"alice",
			nil,
			[]string{"/keybase/private/alice,bob/a/c"},
		},
	}

	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			mkfile("a/b", "hello"),
		),
		as(bob,
			checkUserEditHistory(expectedEdits1),
		),
		as(alice,
			checkUserEditHistory(expectedEdits1),
		),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a/c", "hello2"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits2),
		),
		as(bob,
			checkUserEditHistory(expectedEdits2),
		),
		as(bob,
			addTime(1*time.Minute),
			write("a/b", "hello again"),
		),
		as(bob,
			checkUserEditHistory(expectedEdits3),
		),
		as(alice,
			checkUserEditHistory(expectedEdits3),
		),
		as(alice,
			addTime(1*time.Minute),
			rm("a/c"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits4),
		),
		as(bob,
			checkUserEditHistory(expectedEdits4),
		),
	)
}

func TestEditHistoryMultiTlf(t *testing.T) {
	// Bob writes one file to private.
	expectedEdits1 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"bob",
			[]string{"/keybase/private/alice,bob/a"},
			nil,
		},
	}
	// Alice writes one file to public.
	expectedEdits2 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PUBLIC,
			"alice",
			[]string{"/keybase/public/alice,bob/b"},
			nil,
		},
		expectedEdits1[0],
	}
	// Bob writes one file to team TLF.
	expectedEdits3 := []expectedEdit{
		{
			"ab",
			keybase1.FolderType_TEAM,
			"bob",
			[]string{"/keybase/team/ab/c"},
			nil,
		},
		expectedEdits2[0],
		expectedEdits1[0],
	}

	test(t,
		users("alice", "bob"),
		team("ab", "alice,bob", ""),
		as(bob,
			mkfile("a", "hello"),
		),
		as(bob,
			checkUserEditHistory(expectedEdits1),
		),
		as(alice,
			checkUserEditHistory(expectedEdits1),
		),
		inPublicTlf("alice,bob"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("b", "hello"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits2),
		),
		as(bob,
			checkUserEditHistory(expectedEdits2),
		),
		inSingleTeamTlf("ab"),
		as(bob,
			addTime(1*time.Minute),
			write("c", "hello again"),
		),
		as(bob,
			checkUserEditHistory(expectedEdits3),
		),
		as(alice,
			checkUserEditHistory(expectedEdits3),
		),
	)
}

func TestEditHistorySelfClusters(t *testing.T) {
	// Bob writes one file to private.
	expectedEdits1 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"bob",
			[]string{"/keybase/private/alice,bob/a"},
			nil,
		},
	}
	// Alice writes to ten team TLFs, but bob should still see his own
	// write from above.
	expectedEdits2Alice := make([]expectedEdit, 0, 10)
	expectedEdits2Bob := make([]expectedEdit, 0, 10)
	for i := 9; i >= 0; i-- {
		team := fmt.Sprintf("ab%d", i)
		e := expectedEdit{
			team,
			keybase1.FolderType_TEAM,
			"alice",
			[]string{fmt.Sprintf("/keybase/team/%s/a", team)},
			nil,
		}
		expectedEdits2Alice = append(expectedEdits2Alice, e)
		expectedEdits2Bob = append(expectedEdits2Bob, e)
	}
	expectedEdits2Bob[9] = expectedEdits1[0]

	test(t,
		users("alice", "bob"),
		team("ab0", "alice,bob", ""),
		team("ab1", "alice,bob", ""),
		team("ab2", "alice,bob", ""),
		team("ab3", "alice,bob", ""),
		team("ab4", "alice,bob", ""),
		team("ab5", "alice,bob", ""),
		team("ab6", "alice,bob", ""),
		team("ab7", "alice,bob", ""),
		team("ab8", "alice,bob", ""),
		team("ab9", "alice,bob", ""),
		as(bob,
			mkfile("a", "hello"),
		),
		as(bob,
			checkUserEditHistory(expectedEdits1),
		),
		as(alice,
			checkUserEditHistory(expectedEdits1),
		),
		inSingleTeamTlf("ab0"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab1"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab2"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab3"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab4"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab5"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab6"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab7"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab8"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		inSingleTeamTlf("ab9"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits2Alice),
		),
		as(bob,
			checkUserEditHistory(expectedEdits2Bob),
		),
	)
}

func TestEditHistoryUnflushed(t *testing.T) {
	// Bob writes one file.
	expectedEdits1 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"bob",
			[]string{"/keybase/private/alice,bob/a/b"},
			nil,
		},
	}
	// Alice and Bob both write a second file, but alice's is unflushed.
	expectedEdits2Alice := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"alice",
			[]string{"/keybase/private/alice,bob/a/c"},
			nil,
		},
		expectedEdits1[0],
	}
	expectedEdits2Bob := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"bob",
			[]string{
				"/keybase/private/alice,bob/a/d",
				"/keybase/private/alice,bob/a/b",
			},
			nil,
		},
	}
	// Alice runs CR and flushes her journal.
	expectedEdits3 := []expectedEdit{
		expectedEdits2Alice[0],
		expectedEdits2Bob[0],
	}

	expectedEdits4 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"alice",
			nil,
			[]string{
				"/keybase/private/alice,bob/a/d",
				"/keybase/private/alice,bob/a/c",
				"/keybase/private/alice,bob/a/b",
			},
		},
	}

	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(alice,
			enableJournal(),
		),
		as(bob,
			mkfile("a/b", "hello"),
		),
		as(bob,
			checkUserEditHistory(expectedEdits1),
		),
		as(alice,
			checkUserEditHistory(expectedEdits1),
		),
		as(alice,
			pauseJournal(),
			addTime(1*time.Minute),
			mkfile("a/c", "hello2"),
		),
		as(bob,
			addTime(1*time.Minute),
			mkfile("a/d", "hello"),
		),
		as(bob,
			checkUserEditHistory(expectedEdits2Bob),
		),
		as(alice, noSync(),
			checkUserEditHistory(expectedEdits2Alice),
		),
		as(alice, noSync(),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(alice,
			// Extra flush to make sure the edit history messages have
			// been received by all users.
			flushJournal(),
		),
		as(alice,
			checkUserEditHistory(expectedEdits3),
		),
		as(bob,
			checkUserEditHistory(expectedEdits3),
		),
		as(alice,
			pauseJournal(),
			addTime(1*time.Minute),
			rm("a/b"),
			rm("a/c"),
			rm("a/d"),
			rmdir("a"),
		),
		as(alice,
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob",
				"/keybase/private/alice,bob/a",
			}),
		),
		as(alice, noSync(),
			resumeJournal(),
			flushJournal(),
		),
		as(alice,
			checkUserEditHistory(expectedEdits4),
		),
		as(bob,
			checkUserEditHistory(expectedEdits4),
		),
	)
}

func TestEditHistoryRenameParent(t *testing.T) {
	// Bob writes one file, and alice renames the parent dir.
	expectedEdits := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"bob",
			[]string{"/keybase/private/alice,bob/c/b"},
			nil,
		},
	}

	expectedEdits2 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"alice",
			nil,
			[]string{"/keybase/private/alice,bob/c/b"},
		},
	}

	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			mkfile("a/b", "hello"),
		),
		as(alice,
			addTime(1*time.Minute),
			rename("a", "c"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits),
		),
		as(bob,
			checkUserEditHistory(expectedEdits),
		),
		as(alice,
			addTime(1*time.Minute),
			rm("c/b"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits2),
		),
		as(bob,
			checkUserEditHistory(expectedEdits2),
		),
	)
}

func TestEditHistoryRenameParentAcrossDirs(t *testing.T) {
	// Bob writes one file, and alice renames the parent dir into a
	// different subdirectory.
	expectedEdits := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"bob",
			[]string{"/keybase/private/alice,bob/d/c/b"},
			nil,
		},
	}

	expectedEdits2 := []expectedEdit{
		{
			"alice,bob",
			keybase1.FolderType_PRIVATE,
			"alice",
			nil,
			[]string{"/keybase/private/alice,bob/d/c/b"},
		},
	}

	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
			mkdir("d"),
		),
		as(bob,
			mkfile("a/b", "hello"),
		),
		as(alice,
			addTime(1*time.Minute),
			rename("a", "d/c"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits),
		),
		as(bob,
			checkUserEditHistory(expectedEdits),
		),
		as(alice,
			addTime(1*time.Minute),
			rm("d/c/b"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits2),
		),
		as(bob,
			checkUserEditHistory(expectedEdits2),
		),
	)
}

// Regression test for HOTPOT-616.
func TestEditHistoryRenameDirAndReuseNameForFile(t *testing.T) {
	// Alice creates a dir and puts files in it, creates a file,
	// renames the dir to something new, renames the file to
	// the old dir name, and then nukes the old directory.
	expectedEdits := []expectedEdit{
		{
			"alice",
			keybase1.FolderType_PRIVATE,
			"alice",
			[]string{"/keybase/private/alice/a"},
			[]string{
				"/keybase/private/alice/b/c/d",
				"/keybase/private/alice/b/b",
			},
		},
	}

	test(t, batchSize(20),
		users("alice"),
		as(alice,
			mkdir("a"),
			mkfile("a/b", ""),
			pwriteBSSync("a/b", []byte("hello"), 0, false),
			mkdir("a/c"),
			mkfile("a/c/d", ""),
			pwriteBSSync("a/c/d", []byte("hello"), 0, false),
		),
		as(alice,
			mkfile("e", ""),
			pwriteBSSync("e", []byte("world"), 0, false),
			rename("a", "b"),
			rename("e", "a"),
			rm("b/c/d"),
			rmdir("b/c"),
			rm("b/b"),
			rmdir("b"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits),
		),
	)
}

// Regression test for https://github.com/keybase/client/issues/19151.
func TestEditHistoryRenameDirAndReuseNameForLink(t *testing.T) {
	// Alice creates a dir and puts files in it, renames the dir to
	// something new and then removes it, and makes a symlink using
	// the old name to the new name.
	expectedEdits := []expectedEdit{
		{
			"alice",
			keybase1.FolderType_PRIVATE,
			"alice",
			nil,
			[]string{
				"/keybase/private/alice/b/c/d",
				"/keybase/private/alice/b/b",
			},
		},
	}

	test(t, batchSize(20),
		users("alice"),
		as(alice,
			mkdir("a"),
			mkfile("a/b", ""),
			pwriteBSSync("a/b", []byte("hello"), 0, false),
			mkdir("a/c"),
			mkfile("a/c/d", ""),
			pwriteBSSync("a/c/d", []byte("hello"), 0, false),
		),
		as(alice,
			rename("a", "b"),
			rm("b/c/d"),
			rmdir("b/c"),
			rm("b/b"),
			rmdir("b"),
			mkdir("e"),
			link("a", "e"),
		),
		as(alice,
			checkUserEditHistory(expectedEdits),
		),
	)
}

// Regression test for HOTPOT-803.
func TestEditHistoryUnflushedRenameOverNewFile(t *testing.T) {
	// Alice creates a file in the first revision, but then creates
	// a file in the second revision that is renamed over the
	// original file.  She also creates a file that is removed.
	expectedEdits := []expectedEdit{
		{
			"alice",
			keybase1.FolderType_PRIVATE,
			"alice",
			[]string{
				"/keybase/private/alice/a",
			},
			[]string{
				"/keybase/private/alice/c",
			},
		},
	}

	test(t, journal(),
		users("alice"),
		as(alice,
			mkfile("a", "a foo"),
		),
		as(alice,
			enableJournal(),
		),
		as(alice,
			pwriteBSSync("b", []byte("b foo"), 0, false),
			rename("a", "c"),
			pwriteBSSync("a", []byte("a2 foo"), 0, false),
			rename("b", "a"),
			rm("c"),
		),
		as(alice,
			lsdir("", m{"a$": "FILE"}),
			read("a", "b foo"),
			checkUserEditHistory(expectedEdits),
		),
	)
}

// A more complex regression test for HOTPOT-803 than the above test,
// but it is more faithful to the actual user log.
func TestEditHistoryUnflushedRenameOverTwoNewFiles(t *testing.T) {
	// Alice creates two files in the first revision, but then creates
	// 2 files in the second revision that are renamed over the
	// original two files.  She also creates two files that are removed.
	expectedEdits := []expectedEdit{
		{
			"alice",
			keybase1.FolderType_PRIVATE,
			"alice",
			[]string{
				"/keybase/private/alice/a",
				"/keybase/private/alice/b",
			},
			[]string{
				"/keybase/private/alice/f",
				"/keybase/private/alice/e",
			},
		},
	}

	test(t, journal(),
		users("alice"),
		as(alice,
			mkfile("a", "a foo"),
			mkfile("b", "b foo"),
		),
		as(alice,
			enableJournal(),
		),
		as(alice,
			pwriteBSSync("c", []byte("c foo"), 0, false),
			pwriteBSSync("d", []byte("d foo"), 0, false),
			rename("b", "e"),
			pwriteBSSync("f", []byte("f foo"), 0, false),
			rename("a", "f"),
			rename("c", "b"),
			pwriteBSSync("a", []byte("a2 foo"), 0, false),
			rename("d", "a"),
			rm("e"),
			rm("f"),
		),
		as(alice,
			lsdir("", m{"a$": "FILE", "b$": "FILE"}),
			read("a", "d foo"),
			read("b", "c foo"),
			// Sort the entries because when we add in the rename
			// operations, the order is undefined and 'a' and 'b'
			// could be swapped since they happen in the same revision
			// and are independent.
			checkUserEditHistoryWithSort(expectedEdits, true),
		),
	)
}
