// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlfhandle

import (
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/idutil"
	idutiltest "github.com/keybase/client/go/kbfs/idutil/test"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestParseHandleEarlyFailure(t *testing.T) {
	ctx := context.Background()

	name := "w1,w2#r1"
	_, err := ParseHandle(ctx, nil, nil, nil, name, tlf.Public)
	assert.Equal(t, idutil.NoSuchNameError{Name: name}, err)

	nonCanonicalName := "W1,w2#r1"
	_, err = ParseHandle(ctx, nil, nil, nil, nonCanonicalName, tlf.Private)
	assert.Equal(
		t, idutil.TlfNameNotCanonical{
			Name: nonCanonicalName, NameToTry: name}, errors.Cause(err))
}

func TestParseHandleNoUserFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	name := "u2,u3#u4"
	_, err := ParseHandle(ctx, kbpki, nil, nil, name, tlf.Private)
	assert.Equal(t, 0, kbpki.GetIdentifyCalls())
	assert.Equal(t, idutil.NoSuchUserError{Input: "u4"}, err)
}

func TestParseHandleNotReaderFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	name := "u2,u3"
	_, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil, name,
		tlf.Private)
	assert.Equal(t, 0, kbpki.GetIdentifyCalls())
	assert.Equal(t, ReadAccessError{User: "u1", Tlf: tlf.CanonicalName(name), Type: tlf.Private, Filename: "/keybase/private/u2,u3"}, err)
}

func TestParseHandleSingleTeam(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers([]kbname.NormalizedUsername{"u1"})
	currentUID := localUsers[0].UID
	localTeams := idutil.MakeLocalTeams([]kbname.NormalizedUsername{"t1"})
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, localTeams, kbfscodec.NewMsgpack())

	tlfID := tlf.FakeID(0, tlf.SingleTeam)
	err := daemon.CreateTeamTLF(ctx, localTeams[0].TID, tlfID)
	require.NoError(t, err)

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlfID}, nil, "t1", tlf.SingleTeam)
	assert.Equal(t, 0, kbpki.GetIdentifyCalls())
	require.NoError(t, err)
	require.Equal(t, tlfID, h.tlfID)
}

func TestParseHandleSingleTeamFailures(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	localTeams := idutil.MakeLocalTeams(
		[]kbname.NormalizedUsername{"t1", "t2"})
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, localTeams, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	_, err := ParseHandle(ctx, kbpki, nil, nil, "u1", tlf.SingleTeam)
	assert.Equal(t, 0, kbpki.GetIdentifyCalls())
	assert.Equal(t, idutil.NoSuchUserError{Input: "u1@team"}, err)

	checkNoSuchName := func(name string, ty tlf.Type) {
		_, err := ParseHandle(ctx, kbpki, nil, nil, name, ty)
		assert.Equal(t, 0, kbpki.GetIdentifyCalls())
		if ty == tlf.SingleTeam {
			assert.Equal(t, idutil.NoSuchNameError{Name: name}, err)
		} else {
			assert.Equal(t, idutil.NoSuchUserError{Input: "t1"}, err)
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

func TestParseHandleAssertionNotCanonicalFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	localUsers[2].Asserts = []string{"u3@twitter"}
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	name := "u1,u3#u2"
	nonCanonicalName := "u1,u3@twitter#u2"
	_, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		nonCanonicalName, tlf.Private)
	// Names with assertions should be identified before the error
	// is returned.
	assert.Equal(t, 3, kbpki.GetIdentifyCalls())
	assert.Equal(
		t, idutil.TlfNameNotCanonical{Name: nonCanonicalName, NameToTry: name},
		errors.Cause(err))
}

func TestParseHandleAssertionPrivateSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	name := "u1,u3"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil, name,
		tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, 0, kbpki.GetIdentifyCalls())
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeHandle(
		context.Background(), h.ToBareHandleOrBust(), tlf.Private,
		kbpki, kbpki, nil, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h2.GetCanonicalName())
}

func TestParseHandleAssertionPublicSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	name := "u1,u2,u3"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Public)}, nil,
		name, tlf.Public)
	require.NoError(t, err)
	assert.Equal(t, 0, kbpki.GetIdentifyCalls())
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeHandle(
		context.Background(), h.ToBareHandleOrBust(), tlf.Public,
		kbpki, kbpki, nil, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h2.GetCanonicalName())
}

func TestHandleAccessorsPrivate(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2@twitter,u3,u4@twitter#u2,u5@twitter,u6@twitter"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		name, tlf.Private)
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

func TestHandleAccessorsPublic(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2@twitter,u3,u4@twitter"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Public)}, nil,
		name, tlf.Public)
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

func TestHandleConflictInfo(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := idutil.NewDaemonLocal(currentUID, localUsers, nil, codec)
	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2,u3"
	cname := tlf.CanonicalName(name)
	h, err := ParseHandle(ctx, kbpki, nil, nil, name, tlf.Public)
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

func TestHandleFinalizedInfo(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := idutil.NewDaemonLocal(currentUID, localUsers, nil, codec)
	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2,u3"
	cname := tlf.CanonicalName(name)
	h, err := ParseHandle(ctx, kbpki, nil, nil, name, tlf.Public)
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

func TestHandleConflictAndFinalizedInfo(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := idutil.NewDaemonLocal(currentUID, localUsers, nil, codec)
	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2,u3"
	h, err := ParseHandle(ctx, kbpki, nil, nil, name, tlf.Public)
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

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3", "u4", "u5"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := idutil.NewDaemonLocal(currentUID, localUsers, nil, codec)

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name1 := "u1,u2@twitter,u3,u4@twitter"
	h1, err := ParseHandle(ctx, kbpki, nil, nil, name1, tlf.Public)
	require.NoError(t, err)

	eq, err := h1.Equals(codec, *h1)
	require.NoError(t, err)
	require.True(t, eq)

	// Test public bit.

	h2, err := ParseHandle(ctx, kbpki, nil, nil, name1, tlf.Private)
	require.NoError(t, err)
	eq, err = h1.Equals(codec, *h2)
	require.NoError(t, err)
	require.False(t, eq)

	// Test resolved and unresolved readers and writers.

	name1 = "u1,u2@twitter#u3,u4@twitter"
	h1, err = ParseHandle(ctx, kbpki, nil, nil, name1, tlf.Private)
	require.NoError(t, err)

	for _, name2 := range []string{
		"u1,u2@twitter,u5#u3,u4@twitter",
		"u1,u5@twitter#u3,u4@twitter",
		"u1,u2@twitter#u4@twitter,u5",
		"u1,u2@twitter#u3,u5@twitter",
	} {
		h2, err := ParseHandle(ctx, kbpki, nil, nil, name2, tlf.Private)
		require.NoError(t, err)
		eq, err := h1.Equals(codec, *h2)
		require.NoError(t, err)
		require.False(t, eq)
	}

	// Test conflict info and finalized info.

	h2, err = ParseHandle(ctx, kbpki, nil, nil, name1, tlf.Private)
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

	h2, err = ParseHandle(ctx, kbpki, nil, nil, name1, tlf.Private)
	require.NoError(t, err)
	h2.SetFinalizedInfo(&info)

	eq, err = h1.Equals(codec, *h2)
	require.NoError(t, err)
	require.False(t, eq)

	// Test failure on name difference.
	h2, err = ParseHandle(ctx, kbpki, nil, nil, name1, tlf.Private)
	require.NoError(t, err)
	h2.name += "x"
	eq, err = h1.Equals(codec, *h2)
	require.NoError(t, err)
	require.False(t, eq)
}

func TestParseHandleSocialAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	name := "u1,u2#u3@twitter"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		name, tlf.Private)
	assert.Equal(t, 0, kbpki.GetIdentifyCalls())
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// Make sure that generating another handle doesn't change the
	// name.
	h2, err := MakeHandle(
		context.Background(), h.ToBareHandleOrBust(), tlf.Private,
		kbpki, kbpki, nil, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h2.GetCanonicalName())
}

func TestParseHandleUIDAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid"
	_, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		a, tlf.Private)
	assert.Equal(t, 1, kbpki.GetIdentifyCalls())
	assert.Equal(t, idutil.TlfNameNotCanonical{
		Name: a, NameToTry: "u1"}, errors.Cause(err))
}

func TestParseHandleAndAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2"})
	localUsers[0].Asserts = []string{"u1@twitter"}
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid+u1@twitter"
	_, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		a, tlf.Private)
	// We expect 1 extra identify for compound assertions until
	// KBFS-2022 is completed.
	assert.Equal(t, 1+1, kbpki.GetIdentifyCalls())
	assert.Equal(t, idutil.TlfNameNotCanonical{
		Name: a, NameToTry: "u1"}, errors.Cause(err))
}

func TestParseHandleConflictSuffix(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers([]kbname.NormalizedUsername{"u1"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	ci := &tlf.HandleExtension{
		Date:   1462838400,
		Number: 1,
		Type:   tlf.HandleExtensionConflict,
	}

	a := "u1 " + ci.String()
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		a, tlf.Private)
	require.NoError(t, err)
	require.NotNil(t, h.ConflictInfo())
	require.Equal(t, ci.String(), h.ConflictInfo().String())
}

func TestParseHandleFailConflictingAssertion(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2"})
	localUsers[1].Asserts = []string{"u2@twitter"}
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.IdentifyCountingKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
	}

	a := currentUID.String() + "@uid+u2@twitter"
	_, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		a, tlf.Private)
	// We expect 1 extra identify for compound assertions until
	// KBFS-2022 is completed.
	assert.Equal(t, 0+1, kbpki.GetIdentifyCalls())
	require.Error(t, err)
}

func TestResolveAgainBasic(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2#u3@twitter"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		name, tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	// ResolveAgain shouldn't rely on resolving the original names again.
	daemon.AddNewAssertionForTestOrBust("u3", "u3@twitter")
	newH, err := h.ResolveAgain(ctx, kbpki, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1,u2#u3"), newH.GetCanonicalName())
}

func TestResolveAgainDoubleAsserts(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u1@github,u1@twitter#u2,u2@github,u2@twitter"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		name, tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	daemon.AddNewAssertionForTestOrBust("u1", "u1@twitter")
	daemon.AddNewAssertionForTestOrBust("u1", "u1@github")
	daemon.AddNewAssertionForTestOrBust("u2", "u2@twitter")
	daemon.AddNewAssertionForTestOrBust("u2", "u2@github")
	newH, err := h.ResolveAgain(ctx, kbpki, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1#u2"), newH.GetCanonicalName())
}

func TestResolveAgainWriterReader(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2@github#u2@twitter"
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{tlf.FakeID(1, tlf.Private)}, nil,
		name, tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	daemon.AddNewAssertionForTestOrBust("u2", "u2@twitter")
	daemon.AddNewAssertionForTestOrBust("u2", "u2@github")
	newH, err := h.ResolveAgain(ctx, kbpki, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1,u2"), newH.GetCanonicalName())
}

func TestResolveAgainConflict(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2#u3@twitter"
	id := tlf.FakeID(1, tlf.Private)
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, name, tlf.Private)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName(name), h.GetCanonicalName())

	daemon.AddNewAssertionForTestOrBust("u3", "u3@twitter")
	ext, err := tlf.NewHandleExtension(tlf.HandleExtensionConflict, 1, "", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	h.conflictInfo = ext
	newH, err := h.ResolveAgain(ctx, kbpki, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, tlf.CanonicalName("u1,u2#u3"+
		tlf.HandleExtensionSep+ext.String()), newH.GetCanonicalName())
}

func TestHandleResolvesTo(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3", "u4", "u5"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := idutil.NewDaemonLocal(currentUID, localUsers, nil, codec)

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name1 := "u1,u2@twitter,u3,u4@twitter"
	idPub := tlf.FakeID(1, tlf.Public)
	h1, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err :=
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h1)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	// Test different public bit.

	id := tlf.FakeID(1, tlf.Private)
	h2, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, name1, tlf.Private)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h2)
	require.NoError(t, err)
	require.False(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	// Test adding conflict info or finalized info.

	h2, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
	require.NoError(t, err)
	info := tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h2, err = h2.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h2)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	h2, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
	require.NoError(t, err)
	info = tlf.HandleExtension{
		Date:   101,
		Number: 51,
		Type:   tlf.HandleExtensionFinalized,
	}
	h2.SetFinalizedInfo(&info)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h2)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	// Test differing conflict info or finalized info.

	h2, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
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
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h2)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	h1, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
	require.NoError(t, err)
	h2, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
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
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h2)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	// Try to add conflict info to a finalized handle.

	h2, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
	require.Error(t, err)
	info = tlf.HandleExtension{
		Date:   100,
		Number: 50,
		Type:   tlf.HandleExtensionConflict,
	}
	h2, err = h2.WithUpdatedConflictInfo(codec, &info)
	require.NoError(t, err)

	resolvesTo, partialResolvedH1, err =
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h2)
	require.Error(t, err)

	// Test positive resolution cases.

	name1 = "u1,u2@twitter,u5#u3,u4@twitter"
	h1, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, name1, tlf.Private)
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
		h2, err = ParseHandle(
			ctx, kbpki, ConstIDGetter{id}, nil, tc.name2, tlf.Private)
		require.NoError(t, err)

		daemon.AddNewAssertionForTestOrBust(tc.resolveTo, "u2@twitter")

		resolvesTo, partialResolvedH1, err =
			h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h2)
		require.NoError(t, err)
		assert.True(t, resolvesTo, tc.name2)
		require.Equal(t, h2, partialResolvedH1, tc.name2)

		daemon.RemoveAssertionForTest("u2@twitter")
	}

	// Test negative resolution cases.

	name1 = "u1,u2@twitter,u5#u3,u4@twitter"

	for _, tc := range []testCase{
		{"u1,u5#u3,u4@twitter", "u2"},
		{"u1,u2,u5#u3,u4@twitter", "u1"},
		{"u1,u2,u5#u3,u4@twitter", "u3"},
	} {
		h2, err = ParseHandle(
			ctx, kbpki, ConstIDGetter{id}, nil, tc.name2, tlf.Private)
		require.NoError(t, err)

		daemon.AddNewAssertionForTestOrBust(tc.resolveTo, "u2@twitter")

		resolvesTo, partialResolvedH1, err =
			h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h2)
		require.NoError(t, err)
		assert.False(t, resolvesTo, tc.name2)

		daemon.RemoveAssertionForTest("u2@twitter")
	}
}

func TestHandleMigrationResolvesTo(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	codec := kbfscodec.NewMsgpack()
	daemon := idutil.NewDaemonLocal(currentUID, localUsers, nil, codec)

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	t.Log("Simple private team migration")
	id := tlf.FakeID(1, tlf.Private)
	// Handle without iteam.
	name1 := "u1,u2"
	h1, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, name1, tlf.Private)
	require.NoError(t, err)

	makeImplicitHandle := func(
		name string, ty tlf.Type, id tlf.ID) *Handle {
		wrName, suffix, err := tlf.SplitExtension(name)
		require.NoError(t, err)
		iteamInfo, err := daemon.ResolveIdentifyImplicitTeam(
			ctx, wrName, suffix, ty, true, "",
			keybase1.OfflineAvailability_NONE)
		require.NoError(t, err)
		err = daemon.CreateTeamTLF(ctx, iteamInfo.TID, id)
		require.NoError(t, err)
		h, err := ParseHandle(
			ctx, kbpki, ConstIDGetter{id}, nil, name, ty)
		require.NoError(t, err)
		require.Equal(t, tlf.TeamKeying, h.TypeForKeying())
		return h
	}
	h2 := makeImplicitHandle(name1, tlf.Private, id)

	resolvesTo, partialResolvedH1, err :=
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h2)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1, partialResolvedH1)

	t.Log("Simple public team migration")
	idPub := tlf.FakeID(1, tlf.Public)
	// Handle without iteam.
	h1Pub, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{idPub}, nil, name1, tlf.Public)
	require.NoError(t, err)
	h2Pub := makeImplicitHandle(name1, tlf.Public, idPub)

	resolvesTo, partialResolvedH1, err =
		h1Pub.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{idPub}, nil, *h2Pub)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h1Pub, partialResolvedH1)

	t.Log("Bad migration to team with extra user")
	name2 := "u1,u2,u3"
	h3 := makeImplicitHandle(name2, tlf.Private, id)
	resolvesTo, _, err =
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h3)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Bad migration to team with fewer users")
	name3 := "u1"
	h4 := makeImplicitHandle(name3, tlf.Private, id)
	resolvesTo, _, err =
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h4)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Bad migration to team with new readers")
	name4 := "u1,u2#u3"
	h5 := makeImplicitHandle(name4, tlf.Private, id)
	resolvesTo, _, err =
		h1.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h5)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Private team migration with unresolved users")
	// Handle without iteam.
	name5 := "u1,u2,u3@twitter"
	h6, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, name5, tlf.Private)
	require.NoError(t, err)
	h7 := makeImplicitHandle(name5, tlf.Private, id)
	resolvesTo, partialResolvedH6, err :=
		h6.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h7)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h6, partialResolvedH6)

	t.Log("Bad private team migration with extra unresolved user")
	// Handle without iteam.
	name6 := "u1,u2,u3@twitter,u4@twitter"
	h8 := makeImplicitHandle(name6, tlf.Private, id)
	resolvesTo, _, err =
		h6.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h8)
	require.NoError(t, err)
	require.False(t, resolvesTo)

	t.Log("Private team migration with newly-resolved user")
	daemon.AddNewAssertionForTestOrBust("u3", "u3@twitter")
	resolvesTo, partialResolvedH6, err =
		h6.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h3)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Len(t, partialResolvedH6.UnresolvedWriters(), 0)

	t.Log("Private team migration with conflict info")
	name7 := "u1,u2 (conflicted copy 2016-03-14 #3)"
	h9, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, name7, tlf.Private)
	require.NoError(t, err)
	h10 := makeImplicitHandle(name7, tlf.Private, id)
	resolvesTo, partialResolvedH9, err :=
		h9.ResolvesTo(ctx, codec, kbpki, ConstIDGetter{id}, nil, *h10)
	require.NoError(t, err)
	require.True(t, resolvesTo)
	require.Equal(t, h9, partialResolvedH9)
}

func TestParseHandleNoncanonicalExtensions(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	name := "u1,u2#u3 (conflicted copy 2016-03-14 #3) (files before u2 account reset 2016-03-14 #2)"
	id := tlf.FakeID(1, tlf.Private)
	h, err := ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, name, tlf.Private)
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
	_, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{id}, nil, nonCanonicalName, tlf.Private)
	assert.Equal(
		t, idutil.TlfNameNotCanonical{
			Name: nonCanonicalName, NameToTry: name}, errors.Cause(err))
}

func TestParseHandleImplicitTeams(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, nil, kbfscodec.NewMsgpack())

	kbpki := &idutiltest.DaemonKBPKI{
		Daemon: daemon,
	}

	counter := byte(1)
	newITeam := func(name, suffix string, ty tlf.Type) (
		keybase1.TeamID, tlf.ID) {
		iteamInfo, err := daemon.ResolveIdentifyImplicitTeam(
			ctx, name, suffix, ty, true, "", keybase1.OfflineAvailability_NONE)
		require.NoError(t, err)
		tlfID := tlf.FakeID(counter, ty)
		counter++
		err = daemon.CreateTeamTLF(ctx, iteamInfo.TID, tlfID)
		require.NoError(t, err)
		return iteamInfo.TID, tlfID
	}

	check := func(name string, tid keybase1.TeamID, tlfID tlf.ID, ty tlf.Type) {
		h, err := ParseHandle(ctx, kbpki, nil, nil, name, ty)
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

type offlineResolveCounterKBPKI struct {
	idutil.KBPKI

	lock                    sync.Mutex
	bestEffortOfflineCounts map[string]int
}

func (d *offlineResolveCounterKBPKI) countBestEffort(
	offline keybase1.OfflineAvailability, s string) {
	if offline != keybase1.OfflineAvailability_BEST_EFFORT {
		return
	}
	d.lock.Lock()
	d.bestEffortOfflineCounts[s]++
	d.lock.Unlock()
}

func (d *offlineResolveCounterKBPKI) Resolve(
	ctx context.Context, assertion string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	d.countBestEffort(offline, assertion)
	return d.KBPKI.Resolve(ctx, assertion, offline)
}

func (d *offlineResolveCounterKBPKI) ResolveTeamTLFID(
	ctx context.Context, teamID keybase1.TeamID,
	offline keybase1.OfflineAvailability) (tlf.ID, error) {
	d.countBestEffort(offline, teamID.String())
	return d.KBPKI.ResolveTeamTLFID(ctx, teamID, offline)
}

func (d *offlineResolveCounterKBPKI) ResolveImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	offline keybase1.OfflineAvailability) (idutil.ImplicitTeamInfo, error) {
	d.countBestEffort(offline, "iteam:"+assertions+" "+suffix)
	return d.KBPKI.ResolveImplicitTeam(
		ctx, assertions, suffix, tlfType, offline)
}

type testOfflineStatusPathsGetter struct {
	bestEffortPaths map[string]bool
}

func (t *testOfflineStatusPathsGetter) OfflineAvailabilityForPath(
	tlfPath string) keybase1.OfflineAvailability {
	if t.bestEffortPaths[tlfPath] {
		return keybase1.OfflineAvailability_BEST_EFFORT
	}
	return keybase1.OfflineAvailability_NONE
}

func (t *testOfflineStatusPathsGetter) OfflineAvailabilityForID(
	tlfID tlf.ID) keybase1.OfflineAvailability {
	panic("Not supported")
}

func TestParseHandleOfflineAvailability(t *testing.T) {
	ctx := context.Background()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{"u1", "u2", "u3"})
	localUsers[0].Asserts = []string{"u1@twitter"}
	currentUID := localUsers[0].UID
	localTeams := idutil.MakeLocalTeams(
		[]kbname.NormalizedUsername{"u1u2u3", "u3u2u1"})
	daemon := idutil.NewDaemonLocal(
		currentUID, localUsers, localTeams, kbfscodec.NewMsgpack())

	kbpki := &offlineResolveCounterKBPKI{
		KBPKI: &idutiltest.DaemonKBPKI{
			Daemon: daemon,
		},
		bestEffortOfflineCounts: make(map[string]int),
	}

	osg := &testOfflineStatusPathsGetter{make(map[string]bool)}
	osg.bestEffortPaths["/keybase/private/u2"] = true

	t.Log("Check unsynced private TLF")
	_, err := ParseHandle(ctx, kbpki, nil, osg, "u1", tlf.Private)
	require.NoError(t, err)
	require.Equal(t, kbpki.bestEffortOfflineCounts["u1"], 0)

	t.Log("Check synced private TLF")
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u2", tlf.Private)
	require.NoError(t, err)
	require.Equal(t, kbpki.bestEffortOfflineCounts["u2"], 1)

	t.Log("Check synced private shared TLF")
	osg.bestEffortPaths["/keybase/private/u1,u2,u3"] = true
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u1,u2,u3", tlf.Private)
	require.NoError(t, err)
	require.Equal(t, 1, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 2, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 1, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced private shared TLF, different order")
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u3,u1,u2", tlf.Private)
	assert.Equal(
		t, idutil.TlfNameNotCanonical{Name: "u3,u1,u2", NameToTry: "u1,u2,u3"},
		errors.Cause(err))
	require.Equal(t, 2, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 3, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 2, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced private shared TLF, " +
		"resolved assertions don't use best effort.")
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u1@twitter,u2,u3",
		tlf.Private)
	assert.Equal(
		t, idutil.TlfNameNotCanonical{
			Name: "u1@twitter,u2,u3", NameToTry: "u1,u2,u3"},
		errors.Cause(err))
	require.Equal(t, 2, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 0, kbpki.bestEffortOfflineCounts["u1@twitter"])
	require.Equal(t, 3, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 2, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced private shared TLF, " +
		"unresolved assertions do use best effort.")
	osg.bestEffortPaths["/keybase/private/u1,u2@twitter,u3"] = true
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u1,u2@twitter,u3",
		tlf.Private)
	assert.NoError(t, err)
	require.Equal(t, 3, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 1, kbpki.bestEffortOfflineCounts["u2@twitter"])
	require.Equal(t, 3, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 3, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced private shared TLF, with readers")
	osg.bestEffortPaths["/keybase/private/u1#u2,u3"] = true
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u1#u2,u3",
		tlf.Private)
	assert.NoError(t, err)
	require.Equal(t, 4, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 4, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 4, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced private shared TLF, with readers, different order")
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u1#u3,u2",
		tlf.Private)
	assert.Equal(
		t, idutil.TlfNameNotCanonical{Name: "u1#u3,u2", NameToTry: "u1#u2,u3"},
		errors.Cause(err))
	require.Equal(t, 5, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 5, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 5, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced private shared TLF, with extension")
	ext := "(conflicted copy 2016-03-14 #3)"
	osg.bestEffortPaths["/keybase/private/u1,u2 "+ext] = true
	_, err = ParseHandle(
		ctx, kbpki, nil, osg, "u1,u2 "+ext, tlf.Private)
	assert.NoError(t, err)
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 5, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced private shared TLF, with extension, different order, " +
		"with reader and unresolved assertion")
	osg.bestEffortPaths["/keybase/private/u1,u3#u2@twitter "+ext] = true
	_, err = ParseHandle(
		ctx, kbpki, nil, osg, "u3,u1#u2@twitter "+ext, tlf.Private)
	assert.Equal(
		t, idutil.TlfNameNotCanonical{
			Name:      "u3,u1#u2@twitter " + ext,
			NameToTry: "u1,u3#u2@twitter " + ext,
		}, errors.Cause(err))
	require.Equal(t, 7, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 2, kbpki.bestEffortOfflineCounts["u2@twitter"])
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u3"])

	t.Log("Check synced team TLF")
	osg.bestEffortPaths["/keybase/team/u1u2u3"] = true
	tlfID1 := tlf.FakeID(1, tlf.SingleTeam)
	err = daemon.CreateTeamTLF(ctx, localTeams[0].TID, tlfID1)
	require.NoError(t, err)
	_, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{tlfID1}, osg, "u1u2u3", tlf.SingleTeam)
	assert.NoError(t, err)
	require.Equal(t, 1, kbpki.bestEffortOfflineCounts["team:u1u2u3"])
	require.Equal(t, 7, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 2, kbpki.bestEffortOfflineCounts["u2@twitter"])
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u3"])
	require.Equal(
		t, 1, kbpki.bestEffortOfflineCounts[localTeams[0].TID.String()])

	t.Log("Check unsynced team TLF")
	tlfID2 := tlf.FakeID(2, tlf.SingleTeam)
	err = daemon.CreateTeamTLF(ctx, localTeams[1].TID, tlfID2)
	require.NoError(t, err)
	_, err = ParseHandle(
		ctx, kbpki, ConstIDGetter{tlfID2}, osg, "u3u2u1", tlf.SingleTeam)
	assert.NoError(t, err)
	require.Equal(t, 1, kbpki.bestEffortOfflineCounts["team:u1u2u3"])
	require.Equal(t, 0, kbpki.bestEffortOfflineCounts["team:u3u2u1"])

	t.Log("Check implicit team TLF")
	info, err := daemon.ResolveIdentifyImplicitTeam(
		ctx, "u1,u2,u3", "", tlf.Private, true, "",
		keybase1.OfflineAvailability_BEST_EFFORT)
	require.NoError(t, err)
	tlfID3 := tlf.FakeID(3, tlf.Private)
	err = daemon.CreateTeamTLF(ctx, info.TID, tlfID3)
	require.NoError(t, err)
	_, err = ParseHandle(ctx, kbpki, nil, osg, "u1,u2,u3", tlf.Private)
	require.NoError(t, err)
	// The iteam has a best-effort count of 3, because the earlier
	// lookup of 'u1,u2,u3' and 'u3,u1,u2' already tried to find an
	// implicit team once with best-effort, but there wasn't yet a TLF
	// ID associated with the implicit team.  The per-user counts
	// won't change now that the existence of the TLF ID for the iteam
	// short-circuits those lookups.
	require.Equal(t, 3, kbpki.bestEffortOfflineCounts["iteam:u1,u2,u3 "])
	require.Equal(t, 7, kbpki.bestEffortOfflineCounts["u1"])
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u2"])
	require.Equal(t, 6, kbpki.bestEffortOfflineCounts["u3"])
}
