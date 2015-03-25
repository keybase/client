package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"time"
	// "github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

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
	myUid := currentStatus.User.Uid

	userCli, err := GetUserClient()
	if err != nil {
		return err
	}

	me, err := userCli.LoadUser(keybase_1.LoadUserArg{Uid: &myUid})
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

func (v *CmdStatus) printExportedMe(me keybase_1.User) error {
	fmt.Printf("Username: %s\nID: %s\n", me.Username, me.Uid)
	if len(me.PublicKeys) == 0 {
		fmt.Printf("No public keys.\n")
		return nil
	}
	fmt.Printf("Public keys:\n")
	for _, key := range me.PublicKeys {
		if key.KID == "" {
			return fmt.Errorf("Found a key with an empty KID.")
		}
		role := "subkey"
		if key.IsSibkey {
			role = "sibkey"
		}
		eldestStr := ""
		if key.IsEldest {
			eldestStr = " (eldest)"
		}
		fmt.Printf("  %s (%s)%s\n", key.KID, role, eldestStr)
		if key.PGPFingerprint != "" {
			fmt.Printf("    PGP Fingerprint: %s\n", libkb.PgpFingerprintFromHexNoError(key.PGPFingerprint).ToQuads())
		}
		webStr := ""
		if key.IsWeb {
			webStr = " (web)"
		}
		fmt.Printf("    Device ID: %s%s\n", key.DeviceID, webStr)
		if key.DeviceDescription != "" {
			fmt.Printf("    Device Description: %s\n", key.DeviceDescription)
		}
		fmt.Printf("    Created: %s\n", time.Unix(key.CTime, 0))
		fmt.Printf("    Expires: %s\n", time.Unix(key.ETime, 0))
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
