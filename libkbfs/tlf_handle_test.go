// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

func TestNormalizeNamesInTLF(t *testing.T) {
	writerNames := []string{"BB", "C@Twitter", "d@twitter", "aa"}
	readerNames := []string{"EE", "ff", "AA@HackerNews", "aa", "BB", "bb", "ZZ@hackernews"}
	s, err := normalizeNamesInTLF(writerNames, readerNames, "")
	require.NoError(t, err)
	assert.Equal(t, "aa,bb,c@twitter,d@twitter#AA@hackernews,ZZ@hackernews,aa,bb,bb,ee,ff", s)
}

func TestNormalizeNamesInTLFWithConflict(t *testing.T) {
	writerNames := []string{"BB", "C@Twitter", "d@twitter", "aa"}
	readerNames := []string{"EE", "ff", "AA@HackerNews", "aa", "BB", "bb", "ZZ@hackernews"}
	conflictSuffix := "(cOnflictED coPy 2015-05-11 #4)"
	s, err := normalizeNamesInTLF(writerNames, readerNames, conflictSuffix)
	require.NoError(t, err)
	assert.Equal(t, "aa,bb,c@twitter,d@twitter#AA@hackernews,ZZ@hackernews,aa,bb,bb,ee,ff (conflicted copy 2015-05-11 #4)", s)
}

func TestParseTlfHandleEarlyFailure(t *testing.T) {
	ctx := context.Background()

	name := "w1,w2#r1"
	_, err := ParseTlfHandle(ctx, nil, name, true)
	assert.Equal(t, NoSuchNameError{Name: name}, err)

	nonCanonicalName := "W1,w2#r1"
	_, err = ParseTlfHandle(ctx, nil, nonCanonicalName, false)
	assert.Equal(t, TlfNameNotCanonical{nonCanonicalName, name}, err)
}

func TestParseTlfHandleNoUserFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u2,u3#u4"
	_, err := ParseTlfHandle(ctx, kbpki, name, false)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, NoSuchUserError{"u4"}, err)
}

func TestParseTlfHandleNotReaderFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u2,u3"
	_, err := ParseTlfHandle(ctx, kbpki, name, false)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, ReadAccessError{"u1", CanonicalTlfName(name), false}, err)
}

func TestParseTlfHandleAssertionNotCanonicalFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	localUsers[2].Asserts = []string{"u3@twitter"}
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u3#u2"
	nonCanonicalName := "u1,u3@twitter#u2"
	_, err := ParseTlfHandle(ctx, kbpki, nonCanonicalName, false)
	// Names with assertions should be identified before the error
	// is returned.
	assert.Equal(t, 3, kbpki.getIdentifyCalls())
	assert.Equal(t, TlfNameNotCanonical{nonCanonicalName, name}, err)
}

func TestParseTlfHandleAssertionPrivateSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u3"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	require.NoError(t, err)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeTlfHandle(context.Background(), h.ToBareHandleOrBust(), kbpki)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h2.GetCanonicalName())
}

func TestParseTlfHandleAssertionPublicSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u2,u3"
	h, err := ParseTlfHandle(ctx, kbpki, name, true)
	require.NoError(t, err)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeTlfHandle(context.Background(), h.ToBareHandleOrBust(), kbpki)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h2.GetCanonicalName())
}

func TestTlfHandleAccessorsPrivate(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2@twitter,u3,u4@twitter#u2,u5@twitter,u6@twitter"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	require.NoError(t, err)

	require.False(t, h.IsPublic())

	require.True(t, h.IsWriter(localUsers[0].UID))
	require.True(t, h.IsReader(localUsers[0].UID))

	require.False(t, h.IsWriter(localUsers[1].UID))
	require.True(t, h.IsReader(localUsers[1].UID))

	require.True(t, h.IsWriter(localUsers[2].UID))
	require.True(t, h.IsReader(localUsers[2].UID))

	for i := 6; i < 10; i++ {
		u := keybase1.MakeTestUID(uint32(i))
		require.False(t, h.IsWriter(u))
		require.False(t, h.IsReader(u))
	}

	require.Equal(t, h.ResolvedWriters(),
		[]keybase1.UID{
			localUsers[0].UID,
			localUsers[2].UID,
		})
	require.Equal(t, h.FirstResolvedWriter(), localUsers[0].UID)

	require.Equal(t, h.ResolvedReaders(),
		[]keybase1.UID{
			localUsers[1].UID,
		})

	require.Equal(t, h.UnresolvedWriters(),
		[]keybase1.SocialAssertion{
			{
				User:    "u2",
				Service: "twitter",
			},
			{
				User:    "u4",
				Service: "twitter",
			},
		})
	require.Equal(t, h.UnresolvedReaders(),
		[]keybase1.SocialAssertion{
			{
				User:    "u5",
				Service: "twitter",
			},
			{
				User:    "u6",
				Service: "twitter",
			},
		})
}

func TestTlfHandleAccessorsPublic(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2@twitter,u3,u4@twitter"
	h, err := ParseTlfHandle(ctx, kbpki, name, true)
	require.NoError(t, err)

	require.True(t, h.IsPublic())

	require.True(t, h.IsWriter(localUsers[0].UID))
	require.True(t, h.IsReader(localUsers[0].UID))

	require.False(t, h.IsWriter(localUsers[1].UID))
	require.True(t, h.IsReader(localUsers[1].UID))

	require.True(t, h.IsWriter(localUsers[2].UID))
	require.True(t, h.IsReader(localUsers[2].UID))

	for i := 6; i < 10; i++ {
		u := keybase1.MakeTestUID(uint32(i))
		require.False(t, h.IsWriter(u))
		require.True(t, h.IsReader(u))
	}

	require.Equal(t, h.ResolvedWriters(),
		[]keybase1.UID{
			localUsers[0].UID,
			localUsers[2].UID,
		})
	require.Equal(t, h.FirstResolvedWriter(), localUsers[0].UID)

	require.Nil(t, h.ResolvedReaders())

	require.Equal(t, h.UnresolvedWriters(),
		[]keybase1.SocialAssertion{
			{
				User:    "u2",
				Service: "twitter",
			},
			{
				User:    "u4",
				Service: "twitter",
			},
		})
	require.Nil(t, h.UnresolvedReaders())
}

func TestTlfHandleConflictInfo(t *testing.T) {
	var h TlfHandle

	require.Nil(t, h.ConflictInfo())
	info := ConflictInfo{
		Date:   100,
		Number: 50,
	}

	h.SetConflictInfo(&info)
	require.Equal(t, info, *h.ConflictInfo())

	info.Date = 101
	require.NotEqual(t, info, *h.ConflictInfo())

	h.SetConflictInfo(nil)
	require.Nil(t, h.ConflictInfo())
}

func TestParseTlfHandleSocialAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u2#u3@twitter"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeTlfHandle(context.Background(), h.ToBareHandleOrBust(), kbpki)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h2.GetCanonicalName())
}

func TestParseTlfHandleUIDAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid"
	_, err := ParseTlfHandle(ctx, kbpki, a, false)
	assert.Equal(t, 1, kbpki.getIdentifyCalls())
	assert.Equal(t, TlfNameNotCanonical{a, "u1"}, err)
}

func TestParseTlfHandleAndAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2"})
	localUsers[0].Asserts = []string{"u1@twitter"}
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid+u1@twitter"
	_, err := ParseTlfHandle(ctx, kbpki, a, false)
	assert.Equal(t, 1, kbpki.getIdentifyCalls())
	assert.Equal(t, TlfNameNotCanonical{a, "u1"}, err)
}

func TestParseTlfHandleFailConflictingAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2"})
	localUsers[1].Asserts = []string{"u2@twitter"}
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid+u2@twitter"
	_, err := ParseTlfHandle(ctx, kbpki, a, false)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	require.Error(t, err)
}

// parseTlfHandleOrBust parses the given TLF name, which must be
// canonical, into a TLF handle, and failing if there's an error.
func parseTlfHandleOrBust(t logger.TestLogBackend, config Config,
	name string, public bool) *TlfHandle {
	ctx := context.Background()
	h, err := ParseTlfHandle(ctx, config.KBPKI(), name, public)
	if err != nil {
		t.Fatalf("Couldn't parse %s (public=%t) into a TLF handle: %v",
			name, public, err)
	}
	return h
}

func TestResolveAgainBasic(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2#u3@twitter"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	// ResolveAgain shouldn't rely on resolving the original names again.
	daemon.addNewAssertionForTestOrBust("u3", "u3@twitter")
	newH, err := h.ResolveAgain(ctx, daemon)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName("u1,u2#u3"), newH.GetCanonicalName())
}

func TestResolveAgainDoubleAsserts(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u1@github,u1@twitter#u2,u2@github,u2@twitter"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	daemon.addNewAssertionForTestOrBust("u1", "u1@twitter")
	daemon.addNewAssertionForTestOrBust("u1", "u1@github")
	daemon.addNewAssertionForTestOrBust("u2", "u2@twitter")
	daemon.addNewAssertionForTestOrBust("u2", "u2@github")
	newH, err := h.ResolveAgain(ctx, daemon)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName("u1#u2"), newH.GetCanonicalName())
}

func TestResolveAgainWriterReader(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2@github#u2@twitter"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	daemon.addNewAssertionForTestOrBust("u2", "u2@twitter")
	daemon.addNewAssertionForTestOrBust("u2", "u2@github")
	newH, err := h.ResolveAgain(ctx, daemon)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName("u1,u2"), newH.GetCanonicalName())
}

func TestResolveAgainConflict(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, NewCodecMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2#u3@twitter"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	daemon.addNewAssertionForTest("u3", "u3@twitter")
	ci, err := NewConflictInfo(1)
	if err != nil {
		t.Fatal(err)
	}
	h.conflictInfo = ci
	newH, err := h.ResolveAgain(ctx, daemon)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName("u1,u2#u3"+
		ConflictSuffixSep+ci.String()), newH.GetCanonicalName())
}
