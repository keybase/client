// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"strconv"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestUserHistorySimple(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)

	privSharedTlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)
	privSharedNN := nextNotification{1, 0, privSharedTlfID, nil}
	privSharedTH := NewTlfHistory()
	privSharedName := tlf.CanonicalName("alice,bob")

	privHomeTlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)
	privHomeNN := nextNotification{1, 0, privHomeTlfID, nil}
	privHomeTH := NewTlfHistory()
	privHomeName := tlf.CanonicalName("alice")

	publicTlfID, err := tlf.MakeRandomID(tlf.Public)
	require.NoError(t, err)
	publicNN := nextNotification{1, 0, publicTlfID, nil}
	publicTH := NewTlfHistory()
	publicName := tlf.CanonicalName("alice")

	now := time.Now()
	// Alice writes to private shared TLF.
	var privSharedAlice []string
	for i := 0; i < 3; i++ {
		now = now.Add(1 * time.Minute)
		_ = privSharedNN.make(
			strconv.Itoa(i), NotificationCreate, aliceUID, nil, now)
		privSharedAlice = append(privSharedAlice, privSharedNN.encode(t))
	}
	privSharedTimeAlice := keybase1.ToTime(now)
	// Alice deletes something from private shared TLF (it shouldn't
	// affect the overall server time for the TLF).
	now = now.Add(1 * time.Minute)
	_ = privSharedNN.make("a", NotificationDelete, aliceUID, nil, now)
	privSharedAlice = append(privSharedAlice, privSharedNN.encode(t))

	// Alice writes to public TLF.
	var publicAlice []string
	for i := 0; i < 3; i++ {
		now = now.Add(1 * time.Minute)
		_ = publicNN.make(
			strconv.Itoa(i), NotificationCreate, aliceUID, nil, now)
		publicAlice = append(publicAlice, publicNN.encode(t))
	}
	publicTime := keybase1.ToTime(now)

	// Bob writes to private shared TLF.
	var privSharedBob []string
	for i := 3; i < 6; i++ {
		now = now.Add(1 * time.Minute)
		_ = privSharedNN.make(
			strconv.Itoa(i), NotificationCreate, bobUID, nil, now)
		privSharedBob = append(privSharedBob, privSharedNN.encode(t))
	}
	privSharedTimeBob := keybase1.ToTime(now)

	// Alice writes to private home TLF.
	var privHomeAlice []string
	for i := 0; i < 3; i++ {
		now = now.Add(1 * time.Minute)
		_ = privHomeNN.make(
			strconv.Itoa(i), NotificationCreate, aliceUID, nil, now)
		privHomeAlice = append(privHomeAlice, privHomeNN.encode(t))
	}
	privHomeTime := keybase1.ToTime(now)

	_, err = privSharedTH.AddNotifications(bobName, privSharedBob)
	require.NoError(t, err)
	_, err = privSharedTH.AddNotifications(aliceName, privSharedAlice)
	require.NoError(t, err)

	_, err = privHomeTH.AddNotifications(aliceName, privHomeAlice)
	require.NoError(t, err)

	_, err = publicTH.AddNotifications(aliceName, publicAlice)
	require.NoError(t, err)

	log := logger.New("UH")
	uh := NewUserHistory(log, libkb.NewVDebugLog(log))
	uh.UpdateHistory(privSharedName, tlf.Private, privSharedTH, aliceName)
	uh.UpdateHistory(privHomeName, tlf.Private, privHomeTH, aliceName)
	uh.UpdateHistory(publicName, tlf.Public, publicTH, aliceName)

	type expectInfo struct {
		tlfName    string
		tlfType    keybase1.FolderType
		serverTime keybase1.Time
		writer     string
		num        int
		numDeletes int
	}
	expected := []expectInfo{
		// private home alice
		{
			string(privHomeName), keybase1.FolderType_PRIVATE,
			privHomeTime, aliceName, 3, 0,
		},
		// private shared bob
		{
			string(privSharedName), keybase1.FolderType_PRIVATE,
			privSharedTimeBob, bobName, 3, 0,
		},
		// public alice
		{
			string(publicName), keybase1.FolderType_PUBLIC,
			publicTime, aliceName, 3, 0,
		},
		// private shared alice
		{
			string(privSharedName), keybase1.FolderType_PRIVATE,
			privSharedTimeAlice, aliceName, 3, 1,
		},
	}

	check := func(expected []expectInfo) {
		history := uh.Get(aliceName)
		require.Len(t, history, len(expected))
		for i, wh := range history {
			require.Len(t, wh.History, 1)
			require.Equal(t, expected[i].tlfName, wh.Folder.Name)
			require.Equal(t, expected[i].tlfType, wh.Folder.FolderType)
			require.Equal(t, expected[i].serverTime, wh.ServerTime)
			require.Equal(t, expected[i].writer, wh.History[0].WriterName)
			require.Len(t, wh.History[0].Edits, expected[i].num)
			require.Len(t, wh.History[0].Deletes, expected[i].numDeletes)
		}
	}
	check(expected)

	// Alice writes one more thing to the private shared folder.
	now = now.Add(1 * time.Minute)
	_ = privSharedNN.make("7", NotificationCreate, aliceUID, nil, now)
	_, err = privSharedTH.AddNotifications(
		aliceName, []string{privSharedNN.encode(t)})
	require.NoError(t, err)
	uh.UpdateHistory(privSharedName, tlf.Private, privSharedTH, aliceName)
	expected[3].serverTime = keybase1.ToTime(now)
	expected[3].num++
	expected = append([]expectInfo{expected[3]}, expected[0:3]...)
	check(expected)
}
