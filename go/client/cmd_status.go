package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

const spacesPerIndent = 4

func indentSpace(level int) string {
	return strings.Repeat(" ", level*spacesPerIndent)
}

type CmdStatus struct{}

func (v *CmdStatus) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (v *CmdStatus) Run() (err error) {
	configCli, err := GetConfigClient()
	if err != nil {
		return err
	}

	currentStatus, err := configCli.GetCurrentStatus(0)
	if err != nil {
		return err
	}
	if !currentStatus.LoggedIn {
		return fmt.Errorf("Not logged in.")
	}
	myUID := currentStatus.User.Uid

	userCli, err := GetUserClient()
	if err != nil {
		return err
	}

	me, err := userCli.LoadUser(keybase1.LoadUserArg{Uid: myUID})
	if err != nil {
		return err
	}

	publicKeys, err := userCli.LoadPublicKeys(keybase1.LoadPublicKeysArg{Uid: myUID})
	if err != nil {
		return err
	}

	devCli, err := GetDeviceClient()
	if err != nil {
		return err
	}
	devs, err := devCli.DeviceList(0)
	if err != nil {
		return err
	}

	v.printExportedMe(me, publicKeys, devs)
	return nil
}

func findSubkeys(parentID keybase1.KID, allKeys []keybase1.PublicKey) []keybase1.PublicKey {
	ret := []keybase1.PublicKey{}
	for _, key := range allKeys {
		if keybase1.KIDFromString(key.ParentID).Equal(parentID) {
			ret = append(ret, key)
		}
	}
	return ret
}

func (v *CmdStatus) printExportedMe(me keybase1.User, publicKeys []keybase1.PublicKey, devices []keybase1.Device) error {
	GlobUI.Printf("Username: %s\n", me.Username)
	GlobUI.Printf("User ID: %s\n", me.Uid)
	GlobUI.Printf("Device ID: %s\n", G.Env.GetDeviceID())
	for _, device := range devices {
		if device.DeviceID == G.Env.GetDeviceID() {
			GlobUI.Printf("Device name: %s\n", device.Name)
		}
	}
	if len(publicKeys) == 0 {
		GlobUI.Printf("No public keys.\n")
		return nil
	}
	GlobUI.Printf("Public keys:\n")
	// Keep track of subkeys we print, so that if e.g. a subkey's parent is
	// nonexistent, we can notice that we skipped it.
	subkeysShown := make(map[keybase1.KID]bool)
	for _, key := range publicKeys {
		if !key.IsSibkey {
			// Subkeys will be printed under their respective sibkeys.
			continue
		}
		subkeys := findSubkeys(key.KID, publicKeys)
		err := printKey(key, subkeys, 1)
		if err != nil {
			return err
		}
		for _, subkey := range subkeys {
			subkeysShown[subkey.KID] = true
		}
	}
	// Print errors for any subkeys we failed to show.
	for _, key := range publicKeys {
		if !key.IsSibkey && !subkeysShown[key.KID] {
			errorStr := fmt.Sprintf("Dangling subkey: %s", key.KID)
			G.Log.Error(errorStr) // %s in here angers `go vet`
		}
	}
	return nil
}

func printKey(key keybase1.PublicKey, subkeys []keybase1.PublicKey, indent int) error {
	if key.KID == "" {
		return fmt.Errorf("Found a key with an empty KID.")
	}
	eldestStr := ""
	if key.IsEldest {
		eldestStr = " (eldest)"
	}
	GlobUI.Printf("%s%s%s\n", indentSpace(indent), key.KID, eldestStr)
	if key.PGPFingerprint != "" {
		GlobUI.Printf("%sPGP Fingerprint: %s\n", indentSpace(indent+1), libkb.PGPFingerprintFromHexNoError(key.PGPFingerprint).ToQuads())
		GlobUI.Printf("%sPGP Identities:\n", indentSpace(indent+1))
		for _, identity := range key.PGPIdentities {
			commentStr := ""
			if identity.Comment != "" {
				commentStr = fmt.Sprintf(" (%s)", identity.Comment)
			}
			emailStr := ""
			if identity.Email != "" {
				emailStr = fmt.Sprintf(" <%s>", identity.Email)
			}
			GlobUI.Printf("%s%s%s%s\n", indentSpace(indent+2), identity.Username, commentStr, emailStr)
		}
	}
	if key.DeviceID != "" || key.DeviceType != "" || key.DeviceDescription != "" {
		GlobUI.Printf("%sDevice:\n", indentSpace(indent+1))
		if key.DeviceID != "" {
			GlobUI.Printf("%sID: %s\n", indentSpace(indent+2), key.DeviceID)
		}
		if key.DeviceType != "" {
			GlobUI.Printf("%sType: %s\n", indentSpace(indent+2), key.DeviceType)
		}
		if key.DeviceDescription != "" {
			GlobUI.Printf("%sDescription: %s\n", indentSpace(indent+2), key.DeviceDescription)
		}
	}
	GlobUI.Printf("%sCreated: %s\n", indentSpace(indent+1), keybase1.FromTime(key.CTime))
	GlobUI.Printf("%sExpires: %s\n", indentSpace(indent+1), keybase1.FromTime(key.ETime))

	if subkeys != nil && len(subkeys) > 0 {
		GlobUI.Printf("%sSubkeys:\n", indentSpace(indent+1))
		for _, subkey := range subkeys {
			printKey(subkey, nil, indent+2)
		}
	}
	return nil
}

func NewCmdStatus(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "status",
		Usage: "Show information about the current user",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdStatus{}, "status", c)
		},
	}
}

func (v *CmdStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
