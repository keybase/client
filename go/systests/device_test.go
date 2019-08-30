package systests

import (
	"fmt"
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"strings"
	"testing"
)

func TestRevokeDevices(t *testing.T) {
	set := newTestDeviceSet(t, nil)
	defer set.cleanup()

	// Set up first device
	dev1 := set.newDevice("primary").start(4)

	// Signup the new user for this device
	set.signupUser(dev1)

	// Provision a new device
	dev2 := set.provisionNewDevice("secondary", 1)

	alice := tlfUser{
		keybase1.UID("295a7eea607af32040647123732bc819"),
		[]keybase1.KID{},
	}
	mike := tlfUser{
		keybase1.UID("ff261e3b26543a24ba6c0693820ead19"),
		[]keybase1.KID{keybase1.KID("012073f26b5996912393f7d2961ca90968e4e83d6140e9771ba890ff8ba6ea97777e0a")},
	}

	// Add a new TLF (private/tester#alice) that's fully keyed
	dev1.keyNewTLF(set.uid,
		[]tlfUser{{set.uid, []keybase1.KID{dev1.KID(), dev2.KID(), set.backupKeys[0].KID}}},
		[]tlfUser{alice},
	)

	// Add a new TLF (private/tester#mike) that isn't keyed for the current
	// device
	tlf2 := dev1.keyNewTLF(set.uid,
		[]tlfUser{{set.uid, []keybase1.KID{dev2.KID(), set.backupKeys[0].KID}}},
		[]tlfUser{mike},
	)

	// Call the server and process the API call. Make sure we get a list of
	// "endangered" TLFs that includes private/tester#mike
	cli := keybase1.RekeyClient{Cli: dev1.cli}
	res, err := cli.GetRevokeWarning(context.TODO(), keybase1.GetRevokeWarningArg{
		ActingDevice: dev1.deviceID,
		TargetDevice: dev2.deviceID,
	})

	if err != nil {
		t.Fatalf("Bad answer from RPC: %s", err)
	}

	if n := len(res.EndangeredTLFs); n != 1 {
		t.Fatalf("Expected 1 endangered TLF: got %d", n)
	}

	if id := res.EndangeredTLFs[0].Id; id != tlf2.id {
		t.Fatalf("Got wrong TLF ID; wanted %s; but got %s", tlf2.id, id)
	}

	expectedName := fmt.Sprintf("private/%s#%s", set.username, "t_mike")
	if nm := res.EndangeredTLFs[0].Name; nm != expectedName {
		t.Fatalf("Got wrong TLF name; wanted %q; but got %q", expectedName, nm)
	}

	run := func(accept bool) {
		g := dev1.popClone().G
		ui := newTestUI(g)
		g.SetUI(ui)

		var prompt string
		ui.outputDescHook = func(d libkb.OutputDescriptor, s string) (err error) {
			if d == client.OutputDescriptorEndageredTLFs {
				prompt = s
			}
			return nil
		}

		ui.promptYesNoHook = func(libkb.PromptDescriptor, string, libkb.PromptDefault) (bool, error) {
			return accept, nil
		}

		runner := client.NewCmdDeviceRemoveRunner(g)
		runner.SetIDOrName(dev2.deviceName)
		err = runner.Run()

		if (err == nil) != accept {
			t.Fatalf("With accept=%v, got unexpected error: %v", accept, err)
		}

		if !strings.Contains(prompt, expectedName) {
			t.Fatalf("didn't find expected TLF name %q", expectedName)
		}
	}
	run(false)
	run(true)
}
