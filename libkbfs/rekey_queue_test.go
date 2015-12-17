package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func TestRekeyQueueBasic(t *testing.T) {
	var u1, u2, u3, u4 libkb.NormalizedUsername = "u1", "u2", "u3", "u4"
	config1, uid1, ctx := kbfsOpsConcurInit(t, u1, u2, u3, u4)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	config3 := ConfigAsUser(config1.(*ConfigLocal), u3)
	defer config3.Shutdown()
	uid3, err := config3.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	config4 := ConfigAsUser(config1.(*ConfigLocal), u4)
	defer config4.Shutdown()
	uid4, err := config4.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	kbfsOps1 := config1.KBFSOps()
	var handles []*TlfHandle

	// Create a few shared folders
	for i := 0; i < 3; i++ {
		h := NewTlfHandle()
		h.Writers = append(h.Writers, uid1)
		h.Writers = append(h.Writers, uid2)
		if i > 0 {
			h.Writers = append(h.Writers, uid3)
		}
		if i > 1 {
			h.Writers = append(h.Writers, uid4)
		}
		handles = append(handles, h)
		// user 1 creates the directory
		rootNode1, _, err :=
			kbfsOps1.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
		if err != nil {
			t.Fatalf("Couldn't create folder: %v", err)
		}
		// user 1 creates a file
		_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
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
	kbfsOps2Dev2 := config2Dev2.KBFSOps()

	// user 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	for _, h := range handles {
		_, _, err =
			kbfsOps2Dev2.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
		if _, ok := err.(ReadAccessError); !ok {
			t.Fatalf("Got unexpected error when reading with new key: %v", err)
		}
	}

	var rekeyChannels []<-chan error

	// now user 1 should rekey via its rekey worker
	for _, h := range handles {
		kbfsOps1 := config1.KBFSOps()
		rootNode1, _, err :=
			kbfsOps1.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
		if err != nil {
			t.Fatalf("Couldn't create folder: %v", err)
		}
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
	for _, h := range handles {
		_, _, err =
			kbfsOps2Dev2.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
		if err != nil {
			t.Fatalf("Got unexpected error after rekey: %v", err)
		}
	}
}
