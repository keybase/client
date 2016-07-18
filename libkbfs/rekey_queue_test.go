// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func TestRekeyQueueBasic(t *testing.T) {
	var u1, u2, u3, u4 libkb.NormalizedUsername = "u1", "u2", "u3", "u4"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2, u3, u4)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer config2.Shutdown()
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	config3 := ConfigAsUser(config1.(*ConfigLocal), u3)
	defer config3.Shutdown()
	_, _, err = config3.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	config4 := ConfigAsUser(config1.(*ConfigLocal), u4)
	defer config4.Shutdown()
	_, _, err = config4.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	kbfsOps1 := config1.KBFSOps()
	var names []string

	// Create a few shared folders
	for i := 0; i < 3; i++ {
		writers := []string{u1.String(), u2.String()}
		if i > 0 {
			writers = append(writers, u3.String())
		}
		if i > 1 {
			writers = append(writers, u4.String())
		}
		name := strings.Join(writers, ",")
		names = append(names, name)
		// user 1 creates the directory
		rootNode1 := GetRootNodeOrBust(t, config1, name, false)
		// user 1 creates a file
		_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
		if err != nil {
			t.Fatalf("Couldn't create file: %v", err)
		}
	}

	// Create a new device for user 2
	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer config2Dev2.Shutdown()
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	for _, name := range names {
		_, err := GetRootNodeForTest(config2Dev2, name, false)
		if _, ok := err.(NeedSelfRekeyError); !ok {
			t.Fatalf("Got unexpected error when reading with new key: %v", err)
		}
	}

	var rekeyChannels []<-chan error

	// now user 1 should rekey via its rekey worker
	for _, name := range names {
		rootNode1 := GetRootNodeOrBust(t, config1, name, false)
		// queue it for rekey
		c := config1.RekeyQueue().Enqueue(rootNode1.GetFolderBranch().Tlf)
		rekeyChannels = append(rekeyChannels, c)
	}

	// listen for all of the rekey results
	for _, c := range rekeyChannels {
		if err := <-c; err != nil {
			t.Fatal(err)
		}
	}

	// user 2's new device should be able to read now
	for _, name := range names {
		_ = GetRootNodeOrBust(t, config2Dev2, name, false)
	}
}
