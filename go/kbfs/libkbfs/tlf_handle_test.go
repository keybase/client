// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestNormalizeNamesInTLF(t *testing.T) {
	writerNames := []string{"BB", "C@Twitter", "d@twitter", "aa"}
	readerNames := []string{"EE", "ff", "AA@HackerNews", "aa", "BB", "bb", "ZZ@hackernews"}
	s, changes, err := normalizeNamesInTLF(
		writerNames, readerNames, tlf.Private, "")
	require.NoError(t, err)
	require.True(t, changes)
	assert.Equal(t, "aa,bb,c@twitter,d@twitter#AA@hackernews,ZZ@hackernews,aa,bb,bb,ee,ff", s)
}

func TestNormalizeNamesInTLFWithConflict(t *testing.T) {
	writerNames := []string{"BB", "C@Twitter", "d@twitter", "aa"}
	readerNames := []string{"EE", "ff", "AA@HackerNews", "aa", "BB", "bb", "ZZ@hackernews"}
	conflictSuffix := "(cOnflictED coPy 2015-05-11 #4)"
	s, changes, err := normalizeNamesInTLF(
		writerNames, readerNames, tlf.Private, conflictSuffix)
	require.NoError(t, err)
	require.True(t, changes)
	assert.Equal(t, "aa,bb,c@twitter,d@twitter#AA@hackernews,ZZ@hackernews,aa,bb,bb,ee,ff (conflicted copy 2015-05-11 #4)", s)
}

func TestParseTlfHandleEarlyFailure(t *testing.T) {
	ctx := context.Background()

	name := "w1,w2#r1"
	_, err := ParseTlfHandle(ctx, nil, nil, name, tlf.Public)
	assert.Equal(t, NoSuchNameError{Name: name}, err)

	nonCanonicalName := "W1,w2#r1"
	_, err = ParseTlfHandle(ctx, nil, nil, nonCanonicalName, tlf.Private)
	assert.Equal(
		t, TlfNameNotCanonical{nonCanonicalName, name}, errors.Cause(err))
}

func TestParseTlfHandleNoUserFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u2,u3#u4"
	_, err := ParseTlfHandle(ctx, kbpki, nil, name, tlf.Private)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, NoSuchUserError{"u4"}, err)
}

func TestParseTlfHandleNotReaderFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u2,u3"
	_, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, name,
		tlf.Private)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, ReadAccessError{User: "u1", Tlf: tlf.CanonicalName(name), Type: tlf.Private, Filename: "/keybase/private/u2,u3"}, err)
}

func TestParseTlfHandleSingleTeam(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1"})
	currentUID := localUsers[0].UID
	localTeams := MakeLocalTeams([]kbname.NormalizedUsername{"t1"})
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, localTeams, kbfscodec.NewMsgpack())

	tlfID := tlf.FakeID(0, tlf.SingleTeam)
	err := daemon.CreateTeamTLF(ctx, localTeams[0].TID, tlfID)
	require.NoError(t, err)

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			KBPKI:  NewKBPKIClient(keybaseServiceSelfOwner{daemon}, nil),
			daemon: daemon,
		},
	}

	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlfID}, "t1", tlf.SingleTeam)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	require.NoError(t, err)
	require.Equal(t, tlfID, h.tlfID)
}

func TestParseTlfHandleSingleTeamFailures(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	localTeams := MakeLocalTeams([]kbname.NormalizedUsername{"t1", "t2"})
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, localTeams, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	_, err := ParseTlfHandle(ctx, kbpki, nil, "u1", tlf.SingleTeam)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, NoSuchUserError{Input: "u1@team"}, err)

	checkNoSuchName := func(name string, ty tlf.Type) {
		_, err := ParseTlfHandle(ctx, kbpki, nil, name, ty)
		assert.Equal(t, 0, kbpki.getIdentifyCalls())
		if ty == tlf.SingleTeam {
			assert.Equal(t, NoSuchNameError{Name: name}, err)
		} else {
			assert.Equal(t, NoSuchUserError{Input: "t1"}, err)
		}
	}

	checkNoSuchName("t1,u1", tlf.SingleTeam)
	checkNoSuchName("u1,t1", tlf.SingleTeam)
	checkNoSuchName("t1,t2", tlf.SingleTeam)
	checkNoSuchName("t1#t2", tlf.SingleTeam)
	checkNoSuchName("t1", tlf.Private)
	checkNoSuchName("t1,u1", tlf.Private)
	checkNoSuchName("u1#t1", tlf.Private)
	checkNoSuchName("t1#u1", tlf.Private)
	checkNoSuchName("t1", tlf.Public)
	checkNoSuchName("t1,u1", tlf.Public)
}

func TestParseTlfHandleAssertionNotCanonicalFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	localUsers[2].Asserts = []string{"u3@twitter"}
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u3#u2"
	nonCanonicalName := "u1,u3@twitter#u2"
	_, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)},
		nonCanonicalName, tlf.Private)
	// Names with assertions should be identified before the error
	// is returned.
	assert.Equal(t, 3, kbpki.getIdentifyCalls())
	assert.Equal(
		t, TlfNameNotCanonical{nonCanonicalName, name}, errors.Cause(err))
}

func TestParseTlfHandleAssertionPrivateSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u3"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, name,
		tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeTlfHandle(
		context.Background(), h.ToBareHandleOrBust(), tlf.Private,
		kbpki, kbpki, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h2.GetCanonicalName())
}

func TestParseTlfHandleAssertionPublicSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u2,u3"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Public)}, name, tlf.Public)
	require.NoError(t, err)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeTlfHandle(
		context.Background(), h.ToBareHandleOrBust(), tlf.Public,
		kbpki, kbpki, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h2.GetCanonicalName())
}

func TestTlfHandleAccessorsPrivate(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2@twitter,u3,u4@twitter#u2,u5@twitter,u6@twitter"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, name,
		tlf.Private)
	require.NoError(t, err)

	require.False(t, h.Type() == tlf.Public)

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
		[]keybase1.UserOrTeamID{
			localUsers[0].UID.AsUserOrTeam(),
			localUsers[2].UID.AsUserOrTeam(),
		})
	require.Equal(t, h.FirstResolvedWriter(), localUsers[0].UID.AsUserOrTeam())

	require.Equal(t, h.ResolvedReaders(),
		[]keybase1.UserOrTeamID{
			localUsers[1].UID.AsUserOrTeam(),
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

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2@twitter,u3,u4@twitter"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Public)}, name, tlf.Public)
	require.NoError(t, err)

	require.True(t, h.Type() == tlf.Public)

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
		[]keybase1.UserOrTeamID{
			localUsers[0].UID.AsUserOrTeam(),
			localUsers[2].UID.AsUserOrTeam(),
		})
	require.Equal(t, h.FirstResolvedWriter(), localUsers[0].UID.AsUserOrTeam())

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
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, nil, codec)
	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2,u3"
	cname := tlf.CanonicalName(name)
	h, err := ParseTlfHandle(ctx, kbpki, nil, name, tlf.Public)
	require.NoError(t, err)

	require.Nil(t, h.ConflictInfo())

	h, err = h.WithUpdatedConflictInfo(codec, nil)
	require.NoError(t, err)
	require.Equal(t, h.GetCanonicalName(), cname)

	info := tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h, err = h.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)
	require.Equal(t, info, *h.ConflictInfo())
	cname2 := tlf.CanonicalName(name + tlf.HandleExtensionSep + info.String())
	require.Equal(t, h.GetCanonicalName(), cname2)

	info.Date = 101
	require.NotEqual(t, info, *h.ConflictInfo())

	info.Date = 100
	h, err = h.WithUpdatedConflictInfo(codec, &info)
	cname3 := tlf.CanonicalName(name + tlf.HandleExtensionSep + info.String())
	require.NoError(t, err)
	require.Equal(t, h.GetCanonicalName(), cname3)

	expectedErr := tlf.HandleExtensionMismatchError{
		Expected: *h.ConflictInfo(),
		Actual:   nil,
	}
	h, err = h.WithUpdatedConflictInfo(codec, nil)
	require.Equal(t, expectedErr, err)
	require.Equal(t, "Folder handle extension mismatch, expected: (conflicted copy 1970-01-01 #50), actual: <nil>", err.Error())

	expectedErr = tlf.HandleExtensionMismatchError{
		Expected: *h.ConflictInfo(),
		Actual:   &info,
	}
	info.Date = 101
	h, err = h.WithUpdatedConflictInfo(codec, &info)
	require.Equal(t, expectedErr, err)
	// A strange error message, since the difference doesn't show
	// up in the strings. Oh, well.
	require.Equal(t, "Folder handle extension mismatch, expected: (conflicted copy 1970-01-01 #50), actual: (conflicted copy 1970-01-01 #50)", err.Error())
}

func TestTlfHandleFinalizedInfo(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, nil, codec)
	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2,u3"
	cname := tlf.CanonicalName(name)
	h, err := ParseTlfHandle(ctx, kbpki, nil, name, tlf.Public)
	require.NoError(t, err)

	require.Nil(t, h.FinalizedInfo())
	info := tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionFinalized,
	}

	h.SetFinalizedInfo(&info)
	require.Equal(t, info, *h.FinalizedInfo())
	cname2 := tlf.CanonicalName(name + tlf.HandleExtensionSep + info.String())
	require.Equal(t, h.GetCanonicalName(), cname2)

	info.Date = 101
	require.NotEqual(t, info, *h.FinalizedInfo())

	h.SetFinalizedInfo(nil)
	require.Nil(t, h.FinalizedInfo())
	require.Equal(t, h.GetCanonicalName(), cname)
}

func TestTlfHandleConflictAndFinalizedInfo(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, nil, codec)
	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2,u3"
	h, err := ParseTlfHandle(ctx, kbpki, nil, name, tlf.Public)
	require.NoError(t, err)

	require.Nil(t, h.ConflictInfo())

	cInfo := tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h, err = h.WithUpdatedConflictInfo(codec, &cInfo)
	require.NoError(t, err)
	require.Equal(t, cInfo, *h.ConflictInfo())
	cname2 := tlf.CanonicalName(name + tlf.HandleExtensionSep + cInfo.String())
	require.Equal(t, h.GetCanonicalName(), cname2)

	fInfo := tlf.HandleExtension{
		Date:   101,
		Number: 51,
		Type:   tlf.HandleExtensionFinalized,
	}
	h.SetFinalizedInfo(&fInfo)
	require.Equal(t, fInfo, *h.FinalizedInfo())
	require.Equal(t, cInfo, *h.ConflictInfo())
	cname3 := cname2 + tlf.CanonicalName(tlf.HandleExtensionSep+fInfo.String())
	require.Equal(t, h.GetCanonicalName(), cname3)
}

func TestTlfHandlEqual(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{
		"u1", "u2", "u3", "u4", "u5",
	})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, nil, codec)

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name1 := "u1,u2@twitter,u3,u4@twitter"
	h1, err := ParseTlfHandle(ctx, kbpki, nil, name1, tlf.Public)
	require.NoError(t, err)

	eq, err := h1.Equals(codec, *h1)
	require.NoError(t, err)
	require.True(t, eq)

	// Test public bit.

	h2, err := ParseTlfHandle(ctx, kbpki, nil, name1, tlf.Private)
	require.NoError(t, err)
	eq, err = h1.Equals(codec, *h2)
	require.NoError(t, err)
	require.False(t, eq)

	// Test resolved and unresolved readers and writers.

	name1 = "u1,u2@twitter#u3,u4@twitter"
	h1, err = ParseTlfHandle(ctx, kbpki, nil, name1, tlf.Private)
	require.NoError(t, err)

	for _, name2 := range []string{
		"u1,u2@twitter,u5#u3,u4@twitter",
		"u1,u5@twitter#u3,u4@twitter",
		"u1,u2@twitter#u4@twitter,u5",
		"u1,u2@twitter#u3,u5@twitter",
	} {
		h2, err := ParseTlfHandle(ctx, kbpki, nil, name2, tlf.Private)
		require.NoError(t, err)
		eq, err := h1.Equals(codec, *h2)
		require.NoError(t, err)
		require.False(t, eq)
	}

	// Test conflict info and finalized info.

	h2, err = ParseTlfHandle(ctx, kbpki, nil, name1, tlf.Private)
	require.NoError(t, err)
	info := tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h2, err = h2.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)

	eq, err = h1.Equals(codec, *h2)
	require.NoError(t, err)
	require.False(t, eq)

	h2, err = ParseTlfHandle(ctx, kbpki, nil, name1, tlf.Private)
	require.NoError(t, err)
	h2.SetFinalizedInfo(&info)

	eq, err = h1.Equals(codec, *h2)
	require.NoError(t, err)
	require.False(t, eq)

	// Test failure on name difference.
	h2, err = ParseTlfHandle(ctx, kbpki, nil, name1, tlf.Private)
	require.NoError(t, err)
	h2.name += "x"
	eq, err = h1.Equals(codec, *h2)
	require.NoError(t, err)
	require.False(t, eq)
}

func TestParseTlfHandleSocialAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	name := "u1,u2#u3@twitter"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, name,
		tlf.Private)
	assert.Equal(t, 0, kbpki.getIdentifyCalls())
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeTlfHandle(
		context.Background(), h.ToBareHandleOrBust(), tlf.Private,
		kbpki, kbpki, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h2.GetCanonicalName())
}

func TestParseTlfHandleUIDAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid"
	_, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, a, tlf.Private)
	assert.Equal(t, 1, kbpki.getIdentifyCalls())
	assert.Equal(t, TlfNameNotCanonical{a, "u1"}, errors.Cause(err))
}

func TestParseTlfHandleAndAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2"})
	localUsers[0].Asserts = []string{"u1@twitter"}
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid+u1@twitter"
	_, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, a, tlf.Private)
	// We expect 1 extra identify for compound assertions until
	// KBFS-2022 is completed.
	assert.Equal(t, 1+1, kbpki.getIdentifyCalls())
	assert.Equal(t, TlfNameNotCanonical{a, "u1"}, errors.Cause(err))
}

func TestParseTlfHandleConflictSuffix(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	ci := &tlf.HandleExtension{
		Date:   1462838400,
		Number: 1,
		Type:   tlf.HandleExtensionConflict,
	}

	a := "u1 " + ci.String()
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, a, tlf.Private)
	require.NoError(t, err)
	require.NotNil(t, h.ConflictInfo())
	require.Equal(t, ci.String(), h.ConflictInfo().String())
}

func TestParseTlfHandleFailConflictingAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2"})
	localUsers[1].Asserts = []string{"u2@twitter"}
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &identifyCountingKBPKI{
		KBPKI: &daemonKBPKI{
			daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid+u2@twitter"
	_, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, a, tlf.Private)
	// We expect 1 extra identify for compound assertions until
	// KBFS-2022 is completed.
	assert.Equal(t, 0+1, kbpki.getIdentifyCalls())
	require.Error(t, err)
}

// parseTlfHandleOrBust parses the given TLF name, which must be
// canonical, into a TLF handle, and failing if there's an error.
func parseTlfHandleOrBust(t logger.TestLogBackend, config Config,
	name string, ty tlf.Type, id tlf.ID) *TlfHandle {
	ctx := context.Background()
	h, err := ParseTlfHandle(ctx, config.KBPKI(), constIDGetter{id}, name, ty)
	if err != nil {
		t.Fatalf("Couldn't parse %s (type=%s) into a TLF handle: %v",
			name, ty, err)
	}
	return h
}

func TestResolveAgainBasic(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2#u3@twitter"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, name,
		tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// ResolveAgain shouldn't rely on resolving the original names again.
	daemon.addNewAssertionForTestOrBust("u3", "u3@twitter")
	newH, err := h.ResolveAgain(ctx, kbpki, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1,u2#u3"), newH.GetCanonicalName())
}

func TestResolveAgainDoubleAsserts(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u1@github,u1@twitter#u2,u2@github,u2@twitter"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, name,
		tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	daemon.addNewAssertionForTestOrBust("u1", "u1@twitter")
	daemon.addNewAssertionForTestOrBust("u1", "u1@github")
	daemon.addNewAssertionForTestOrBust("u2", "u2@twitter")
	daemon.addNewAssertionForTestOrBust("u2", "u2@github")
	newH, err := h.ResolveAgain(ctx, kbpki, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1#u2"), newH.GetCanonicalName())
}

func TestResolveAgainWriterReader(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2@github#u2@twitter"
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{tlf.FakeID(1, tlf.Private)}, name,
		tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	daemon.addNewAssertionForTestOrBust("u2", "u2@twitter")
	daemon.addNewAssertionForTestOrBust("u2", "u2@github")
	newH, err := h.ResolveAgain(ctx, kbpki, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1,u2"), newH.GetCanonicalName())
}

func TestResolveAgainConflict(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2#u3@twitter"
	id := tlf.FakeID(1, tlf.Private)
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, name, tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	daemon.addNewAssertionForTestOrBust("u3", "u3@twitter")
	ext, err := tlf.NewHandleExtension(tlf.HandleExtensionConflict, 1, "", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	h.conflictInfo = ext
	newH, err := h.ResolveAgain(ctx, kbpki, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1,u2#u3"+
		tlf.HandleExtensionSep+ext.String()), newH.GetCanonicalName())
}

func TestTlfHandleResolvesTo(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{
		"u1", "u2", "u3", "u4", "u5",
	})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, nil, codec)

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name1 := "u1,u2@twitter,u3,u4@twitter"
	idPub := tlf.FakeID(1, tlf.Public)
	h1, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err :=
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h1)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	// Test different public bit.

	id := tlf.FakeID(1, tlf.Private)
	h2, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, name1, tlf.Private)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h2)
	require.NoError(t, err)
	require.False(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	// Test adding conflict info or finalized info.

	h2, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	require.NoError(t, err)
	info := tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h2, err = h2.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h2)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	h2, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	require.NoError(t, err)
	info = tlf.HandleExtension{
		Date:   101,
		Number: 51,
		Type:   tlf.HandleExtensionFinalized,
	}
	h2.SetFinalizedInfo(&info)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h2)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	// Test differing conflict info or finalized info.

	h2, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	require.NoError(t, err)
	info = tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h2, err = h2.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)
	info = tlf.HandleExtension{
		Date:   99,
		Number: 49,
		Type:   tlf.HandleExtensionConflict,
	}
	h1, err = h1.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h2)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	h1, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	require.NoError(t, err)
	h2, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	require.NoError(t, err)
	info = tlf.HandleExtension{
		Date:   101,
		Number: 51,
		Type:   tlf.HandleExtensionFinalized,
	}
	h2.SetFinalizedInfo(&info)
	info = tlf.HandleExtension{
		Date:   102,
		Number: 52,
		Type:   tlf.HandleExtensionFinalized,
	}
	h1.SetFinalizedInfo(&info)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h2)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	// Try to add conflict info to a finalized handle.

	h2, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	info = tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h2, err = h2.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h2)
	require.Error(t, err)

	// Test positive resolution cases.

	name1 = "u1,u2@twitter,u5#u3,u4@twitter"
	h1, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, name1, tlf.Private)
	require.NoError(t, err)

	type testCase struct {
		name2     string
		resolveTo string
	}

	for _, tc := range []testCase{
		// Resolve to new user.
		{"u1,u2,u5#u3,u4@twitter", "u2"},
		// Resolve to existing writer.
		{"u1,u5#u3,u4@twitter", "u1"},
		// Resolve to existing reader.
		{"u1,u3,u5#u4@twitter", "u3"},
	} {
		h2, err = ParseTlfHandle(
			ctx, kbpki, constIDGetter{id}, tc.name2, tlf.Private)
		require.NoError(t, err)

		daemon.addNewAssertionForTestOrBust(tc.resolveTo, "u2@twitter")

		resolvesTo, partialResolvedH1, err =
			h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h2)
		require.NoError(t, err)
		assert.True(t, resolvesTo, tc.name2)
		require.Equal(t, h2, partialResolvedH1, tc.name2)

		daemon.removeAssertionForTest("u2@twitter")
	}

	// Test negative resolution cases.

	name1 = "u1,u2@twitter,u5#u3,u4@twitter"

	for _, tc := range []testCase{
		{"u1,u5#u3,u4@twitter", "u2"},
		{"u1,u2,u5#u3,u4@twitter", "u1"},
		{"u1,u2,u5#u3,u4@twitter", "u3"},
	} {
		h2, err = ParseTlfHandle(
			ctx, kbpki, constIDGetter{id}, tc.name2, tlf.Private)
		require.NoError(t, err)

		daemon.addNewAssertionForTestOrBust(tc.resolveTo, "u2@twitter")

		resolvesTo, partialResolvedH1, err =
			h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h2)
		require.NoError(t, err)
		assert.False(t, resolvesTo, tc.name2)

		daemon.removeAssertionForTest("u2@twitter")
	}
}

func TestTlfHandleMigrationResolvesTo(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{
		"u1", "u2", "u3",
	})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers, nil, codec)

	kbpki := &daemonKBPKI{
		KBPKI:  NewKBPKIClient(keybaseServiceSelfOwner{daemon}, nil),
		daemon: daemon,
	}

	t.Log("Simple private team migration")
	id := tlf.FakeID(1, tlf.Private)
	// Handle without iteam.
	name1 := "u1,u2"
	h1, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, name1, tlf.Private)
	require.NoError(t, err)

	makeImplicitHandle := func(
		name string, ty tlf.Type, id tlf.ID) *TlfHandle {
		wrName, suffix, err := tlf.SplitExtension(name)
		require.NoError(t, err)
		iteamInfo, err := daemon.ResolveIdentifyImplicitTeam(
			ctx, wrName, suffix, ty, true, "")
		require.NoError(t, err)
		err = daemon.CreateTeamTLF(ctx, iteamInfo.TID, id)
		require.NoError(t, err)
		h, err := ParseTlfHandle(
			ctx, kbpki, constIDGetter{id}, name, ty)
		require.NoError(t, err)
		require.Equal(t, tlf.TeamKeying, h.TypeForKeying())
		return h
	}
	h2 := makeImplicitHandle(name1, tlf.Private, id)

	resolvesTo, partialResolvedH1, err :=
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h2)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	t.Log("Simple public team migration")
	idPub := tlf.FakeID(1, tlf.Public)
	// Handle without iteam.
	h1Pub, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{idPub}, name1, tlf.Public)
	require.NoError(t, err)
	h2Pub := makeImplicitHandle(name1, tlf.Public, idPub)

	resolvesTo, partialResolvedH1, err =
		h1Pub.ResolvesTo(ctx, codec, kbpki, constIDGetter{idPub}, *h2Pub)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1Pub, partialResolvedH1)

	t.Log("Bad migration to team with extra user")
	name2 := "u1,u2,u3"
	h3 := makeImplicitHandle(name2, tlf.Private, id)
	resolvesTo, _, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h3)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Bad migration to team with fewer users")
	name3 := "u1"
	h4 := makeImplicitHandle(name3, tlf.Private, id)
	resolvesTo, _, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h4)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Bad migration to team with new readers")
	name4 := "u1,u2#u3"
	h5 := makeImplicitHandle(name4, tlf.Private, id)
	resolvesTo, _, err =
		h1.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h5)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Private team migration with unresolved users")
	// Handle without iteam.
	name5 := "u1,u2,u3@twitter"
	h6, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, name5, tlf.Private)
	require.NoError(t, err)
	h7 := makeImplicitHandle(name5, tlf.Private, id)
	resolvesTo, partialResolvedH6, err :=
		h6.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h7)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h6, partialResolvedH6)

	t.Log("Bad private team migration with extra unresolved user")
	// Handle without iteam.
	name6 := "u1,u2,u3@twitter,u4@twitter"
	h8 := makeImplicitHandle(name6, tlf.Private, id)
	resolvesTo, _, err =
		h6.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h8)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Private team migration with newly-resolved user")
	daemon.addNewAssertionForTestOrBust("u3", "u3@twitter")
	resolvesTo, partialResolvedH6, err =
		h6.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h3)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Len(t, partialResolvedH6.UnresolvedWriters(), 0)

	t.Log("Private team migration with conflict info")
	name7 := "u1,u2 (conflicted copy 2016-03-14 #3)"
	h9, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, name7, tlf.Private)
	require.NoError(t, err)
	h10 := makeImplicitHandle(name7, tlf.Private, id)
	resolvesTo, partialResolvedH9, err :=
		h9.ResolvesTo(ctx, codec, kbpki, constIDGetter{id}, *h10)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h9, partialResolvedH9)
}

func TestParseTlfHandleNoncanonicalExtensions(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2#u3 (conflicted copy 2016-03-14 #3) (files before u2 account reset 2016-03-14 #2)"
	id := tlf.FakeID(1, tlf.Private)
	h, err := ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, name, tlf.Private)
	require.Nil(t, err)
	assert.Equal(t, tlf.HandleExtension{
		Type:   tlf.HandleExtensionConflict,
		Date:   tlf.HandleExtensionStaticTestDate,
		Number: 3,
	}, *h.ConflictInfo())
	assert.Equal(t, tlf.HandleExtension{
		Type:     tlf.HandleExtensionFinalized,
		Date:     tlf.HandleExtensionStaticTestDate,
		Number:   2,
		Username: "u2",
	}, *h.FinalizedInfo())

	nonCanonicalName := "u1,u2#u3 (files before u2 account reset 2016-03-14 #2) (conflicted copy 2016-03-14 #3)"
	_, err = ParseTlfHandle(
		ctx, kbpki, constIDGetter{id}, nonCanonicalName, tlf.Private)
	assert.Equal(
		t, TlfNameNotCanonical{nonCanonicalName, name}, errors.Cause(err))
}

func TestParseTlfHandleImplicitTeams(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &daemonKBPKI{
		daemon: daemon,
	}

	counter := byte(1)
	newITeam := func(name, suffix string, ty tlf.Type) (
		keybase1.TeamID, tlf.ID) {
		iteamInfo, err := daemon.ResolveIdentifyImplicitTeam(
			ctx, name, suffix, ty, true, "")
		require.NoError(t, err)
		tlfID := tlf.FakeID(counter, ty)
		counter++
		err = daemon.CreateTeamTLF(ctx, iteamInfo.TID, tlfID)
		require.NoError(t, err)
		return iteamInfo.TID, tlfID
	}

	check := func(name string, tid keybase1.TeamID, tlfID tlf.ID, ty tlf.Type) {
		h, err := ParseTlfHandle(ctx, kbpki, nil, name, ty)
		require.NoError(t, err)
		require.Len(t, h.ResolvedWriters(), 1)
		require.Len(t, h.ResolvedReaders(), 0)
		require.Len(t, h.UnresolvedWriters(), 0)
		require.Len(t, h.UnresolvedReaders(), 0)
		require.Equal(t, tid.String(), h.FirstResolvedWriter().String())
		require.Equal(t, tlfID, h.tlfID)
	}

	t.Log("Private implicit teams")
	tid1, tlfID1 := newITeam("u1", "", tlf.Private)
	check("u1", tid1, tlfID1, tlf.Private)
	tid2, tlfID2 := newITeam("u1,u2", "", tlf.Private)
	check("u1,u2", tid2, tlfID2, tlf.Private)
	tid3, tlfID3 := newITeam("u1,u2,u3", "", tlf.Private)
	check("u1,u2,u3", tid3, tlfID3, tlf.Private)

	t.Log("Public implicit teams")
	tid4, tlfID4 := newITeam("u1", "", tlf.Public)
	check("u1", tid4, tlfID4, tlf.Public)
	tid5, tlfID5 := newITeam("u1,u2", "", tlf.Public)
	check("u1,u2", tid5, tlfID5, tlf.Public)

	t.Log("Implicit team with a suffix")
	tid6, tlfID6 := newITeam(
		"u1,u2", "(conflicted copy 2016-03-14 #3)", tlf.Private)
	check("u1,u2 (conflicted copy 2016-03-14 #3)", tid6, tlfID6, tlf.Private)

	t.Log("Implicit team with readers")
	tid7, tlfID7 := newITeam("u1,u2#u3", "", tlf.Private)
	check("u1,u2#u3", tid7, tlfID7, tlf.Private)
}
