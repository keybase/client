package client

import (
	"fmt"
	"strings"
	"time"

	"github.com/codegangsta/cli"
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

func (v *CmdStatus) RunClient() (err error) {
	configCli, err := GetConfigClient()
	if err != nil {
		return err
	}

	currentStatus, err := configCli.GetCurrentStatus()
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

	me, err := userCli.LoadUser(keybase1.LoadUserArg{Uid: &myUID})
	if err != nil {
		return err
	}
	v.printExportedMe(me)
	return nil
}

func (v *CmdStatus) Run() error {
	currentStatus, err := libkb.GetCurrentStatus()
	if err != nil {
		return err
	}
	if !currentStatus.LoggedIn {
		return fmt.Errorf("Not logged in.")
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	exported := me.Export()
	err = v.printExportedMe(*exported)
	return err
}

func findSubkeys(parentID string, allKeys []keybase1.PublicKey) []keybase1.PublicKey {
	ret := []keybase1.PublicKey{}
	for _, key := range allKeys {
		if key.ParentID == parentID {
			ret = append(ret, key)
		}
	}
	return ret
}

func (v *CmdStatus) printExportedMe(me keybase1.User) error {
	fmt.Printf("Username: %s\n", me.Username)
	fmt.Printf("User ID: %s\n", me.Uid)
	fmt.Printf("Device ID: %s\n", G.Env.GetDeviceID())
	if len(me.PublicKeys) == 0 {
		fmt.Printf("No public keys.\n")
		return nil
	}
	fmt.Printf("Public keys:\n")
	// Keep track of subkeys we print, so that if e.g. a subkey's parent is
	// nonexistent, we can notice that we skipped it.
	subkeysShown := make(map[string]bool)
	for _, key := range me.PublicKeys {
		if !key.IsSibkey {
			// Subkeys will be printed under their respective sibkeys.
			continue
		}
		subkeys := findSubkeys(key.KID, me.PublicKeys)
		err := printKey(key, subkeys, 1)
		if err != nil {
			return err
		}
		for _, subkey := range subkeys {
			subkeysShown[subkey.KID] = true
		}
	}
	// Print errors for any subkeys we failed to show.
	for _, key := range me.PublicKeys {
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
	fmt.Printf("%s%s%s\n", indentSpace(indent), key.KID, eldestStr)
	if key.PGPFingerprint != "" {
		fmt.Printf("%sPGP Fingerprint: %s\n", indentSpace(indent+1), libkb.PgpFingerprintFromHexNoError(key.PGPFingerprint).ToQuads())
		fmt.Printf("%sPGP Identities:\n", indentSpace(indent+1))
		for _, identity := range key.PGPIdentities {
			commentStr := ""
			if identity.Comment != "" {
				commentStr = fmt.Sprintf(" (%s)", identity.Comment)
			}
			emailStr := ""
			if identity.Email != "" {
				emailStr = fmt.Sprintf(" <%s>", identity.Email)
			}
			fmt.Printf("%s%s%s%s\n", indentSpace(indent+2), identity.Username, commentStr, emailStr)
		}
	}
	webStr := ""
	if key.IsWeb {
		webStr = " (web)"
	}
	if key.DeviceID != "" {
		fmt.Printf("%sDevice ID: %s%s\n", indentSpace(indent+1), key.DeviceID, webStr)
	}
	if key.DeviceDescription != "" {
		fmt.Printf("%sDevice Description: %s\n", indentSpace(indent+1), key.DeviceDescription)
	}
	fmt.Printf("%sCreated: %s\n", indentSpace(indent+1), time.Unix(key.CTime, 0))
	fmt.Printf("%sExpires: %s\n", indentSpace(indent+1), time.Unix(key.ETime, 0))

	if subkeys != nil && len(subkeys) > 0 {
		fmt.Printf("%sSubkeys:\n", indentSpace(indent+1))
		for _, subkey := range subkeys {
			printKey(subkey, nil, indent+2)
		}
	}
	return nil
}

func NewCmdStatus(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "status",
		Usage:       "keybase status",
		Description: "Show information about the current user",
		Flags:       []cli.Flag{},
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
