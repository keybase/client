// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

func TestMakeBareTlfHandle(t *testing.T) {
	w := []keybase1.UID{
		keybase1.MakeTestUID(4),
		keybase1.MakeTestUID(3),
	}

	r := []keybase1.UID{
		keybase1.MakeTestUID(5),
		keybase1.MakeTestUID(1),
	}

	uw := []keybase1.SocialAssertion{
		{
			User:    "user2",
			Service: "service3",
		},
		{
			User:    "user1",
			Service: "service1",
		},
	}

	ur := []keybase1.SocialAssertion{
		{
			User:    "user5",
			Service: "service3",
		},
		{
			User:    "user1",
			Service: "service2",
		},
	}

	h, err := MakeBareTlfHandle(w, r, uw, ur, nil)
	require.NoError(t, err)
	require.Equal(t, []keybase1.UID{
		keybase1.MakeTestUID(3),
		keybase1.MakeTestUID(4),
	}, h.Writers)
	require.Equal(t, []keybase1.UID{
		keybase1.MakeTestUID(1),
		keybase1.MakeTestUID(5),
	}, h.Readers)
	require.Equal(t, []keybase1.SocialAssertion{
		{
			User:    "user1",
			Service: "service1",
		},
		{
			User:    "user2",
			Service: "service3",
		},
	}, h.UnresolvedWriters)
	require.Equal(t, []keybase1.SocialAssertion{
		{
			User:    "user1",
			Service: "service2",
		},
		{
			User:    "user5",
			Service: "service3",
		},
	}, h.UnresolvedReaders)
}

func TestMakeBareTlfHandleFailures(t *testing.T) {
	_, err := MakeBareTlfHandle(nil, nil, nil, nil, nil)
	assert.Equal(t, ErrNoWriters, err)

	w := []keybase1.UID{
		keybase1.MakeTestUID(4),
		keybase1.MakeTestUID(3),
	}

	r := []keybase1.UID{
		keybase1.PUBLIC_UID,
		keybase1.MakeTestUID(2),
	}

	_, err = MakeBareTlfHandle(r, nil, nil, nil, nil)
	assert.Equal(t, ErrInvalidWriter, err)

	_, err = MakeBareTlfHandle(w, r, nil, nil, nil)
	assert.Equal(t, ErrInvalidReader, err)

	ur := []keybase1.SocialAssertion{
		{
			User:    "user5",
			Service: "service3",
		},
	}

	_, err = MakeBareTlfHandle(w, r[:1], nil, ur, nil)
	assert.Equal(t, ErrInvalidReader, err)
}

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
	require.Nil(t, err)
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
	h2, err := MakeTlfHandle(context.Background(), h.BareTlfHandle, kbpki)
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
	h2, err := MakeTlfHandle(context.Background(), h.BareTlfHandle, kbpki)
	require.NoError(t, err)
	assert.Equal(t, CanonicalTlfName(name), h2.GetCanonicalName())
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
	h2, err := MakeTlfHandle(context.Background(), h.BareTlfHandle, kbpki)
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

func TestBareTlfHandleResolveAssertions(t *testing.T) {
	w := []keybase1.UID{
		keybase1.MakeTestUID(4),
		keybase1.MakeTestUID(3),
	}

	r := []keybase1.UID{
		keybase1.MakeTestUID(5),
		keybase1.MakeTestUID(1),
	}

	uw := []keybase1.SocialAssertion{
		{
			User:    "user2",
			Service: "service3",
		},
		{
			User:    "user7",
			Service: "service2",
		},
		{
			User:    "user1",
			Service: "service1",
		},
	}

	ur := []keybase1.SocialAssertion{
		{
			User:    "user6",
			Service: "service3",
		},
		{
			User:    "user8",
			Service: "service1",
		},
		{
			User:    "user5",
			Service: "service1",
		},
		{
			User:    "user1",
			Service: "service2",
		},
		{
			User:    "user9",
			Service: "service1",
		},
		{
			User:    "user9",
			Service: "service3",
		},
	}

	h, err := MakeBareTlfHandle(w, r, uw, ur, nil)
	require.NoError(t, err)

	assertions := make(map[keybase1.SocialAssertion]keybase1.UID)
	assertions[uw[0]] = keybase1.MakeTestUID(2) // new writer
	assertions[uw[2]] = keybase1.MakeTestUID(1) // reader promoted to writer
	assertions[ur[0]] = keybase1.MakeTestUID(6) // new reader
	assertions[ur[2]] = keybase1.MakeTestUID(5) // already a reader
	assertions[ur[3]] = keybase1.MakeTestUID(1) // already a writer
	assertions[ur[4]] = keybase1.MakeTestUID(9) // new reader
	assertions[ur[5]] = keybase1.MakeTestUID(9) // already a reader

	h = h.ResolveAssertions(assertions)

	require.Equal(t, []keybase1.UID{
		keybase1.MakeTestUID(1),
		keybase1.MakeTestUID(2),
		keybase1.MakeTestUID(3),
		keybase1.MakeTestUID(4),
	}, h.Writers)
	require.Equal(t, []keybase1.UID{
		keybase1.MakeTestUID(5),
		keybase1.MakeTestUID(6),
		keybase1.MakeTestUID(9),
	}, h.Readers)
	require.Equal(t, []keybase1.SocialAssertion{
		{
			User:    "user7",
			Service: "service2",
		},
	}, h.UnresolvedWriters)
	require.Equal(t, []keybase1.SocialAssertion{
		{
			User:    "user8",
			Service: "service1",
		},
	}, h.UnresolvedReaders)
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
	require.Nil(t, err)
	assert.Equal(t, CanonicalTlfName(name), h.GetCanonicalName())

	daemon.addNewAssertionForTest("u3", "u3@twitter")
	ci, err := NewConflictInfo(1)
	if err != nil {
		t.Fatal(err)
	}
	h.ConflictInfo = ci
	newH, err := h.ResolveAgain(ctx, daemon)
	require.Nil(t, err)
	assert.Equal(t, CanonicalTlfName("u1,u2#u3"+
		ConflictSuffixSep+ci.String()), newH.GetCanonicalName())
}
