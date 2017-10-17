package main

import (
	"flag"
	"fmt"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func mdDumpGetDeviceString(k kbfscrypto.CryptPublicKey, ui libkbfs.UserInfo) (
	string, bool) {
	deviceName, ok := ui.KIDNames[k.KID()]
	if !ok {
		return "", false
	}

	if revokedTime, ok := ui.RevokedCryptPublicKeys[k]; ok {
		return fmt.Sprintf("%s (revoked %s) (kid:%s)",
			deviceName, revokedTime.Unix.Time(), k), true
	}

	return fmt.Sprintf("%s (kid:%s)", deviceName, k), true
}

func mdDumpGetReplacements(ctx context.Context, codec kbfscodec.Codec,
	service libkbfs.KeybaseService, brmd libkbfs.BareRootMetadata,
	extra libkbfs.ExtraMetadata) (map[string]string, error) {
	writers, readers, err := brmd.GetUserDevicePublicKeys(extra)
	if err != nil {
		return nil, err
	}

	replacements := make(map[string]string)
	for _, userKeys := range []libkbfs.UserDevicePublicKeys{writers, readers} {
		for u, deviceKeys := range userKeys {
			if _, ok := replacements[u.String()]; ok {
				continue
			}

			username, _, err := service.Resolve(
				ctx, fmt.Sprintf("uid:%s", u))
			if err == nil {
				replacements[u.String()] = fmt.Sprintf(
					"%s (uid:%s)", username, u)
			} else {
				printError("md dump", err)
			}

			ui, err := service.LoadUserPlusKeys(ctx, u, "")
			if err != nil {
				continue
			}

			for k := range deviceKeys {
				if _, ok := replacements[k.String()]; ok {
					continue
				}

				if deviceStr, ok := mdDumpGetDeviceString(k, ui); ok {
					replacements[k.String()] = deviceStr
				}
			}
		}
	}

	return replacements, nil
}

func mdDumpReplaceAll(s string, replacements map[string]string) string {
	for old, new := range replacements {
		s = strings.Replace(s, old, new, -1)
	}
	return s
}

func mdDumpReadOnlyRMD(ctx context.Context, config libkbfs.Config,
	rmd libkbfs.ReadOnlyRootMetadata) error {
	c := spew.NewDefaultConfig()
	c.Indent = "  "
	c.DisablePointerAddresses = true
	c.DisableCapacities = true
	c.SortKeys = true

	brmd := rmd.GetBareRootMetadata()
	extra := rmd.Extra()

	replacements, err := mdDumpGetReplacements(
		ctx, config.Codec(), config.KeybaseService(), brmd, extra)
	if err != nil {
		printError("md dump", err)
	}

	brmdDump, err := kbfsmd.DumpRootMetadata(config.Codec(), brmd)
	if err != nil {
		return err
	}

	fmt.Printf("%s\n", mdDumpReplaceAll(brmdDump, replacements))

	fmt.Print("Extra metadata\n")
	fmt.Print("--------------\n")
	extraDump, err := kbfsmd.DumpExtraMetadata(config.Codec(), extra)
	if err != nil {
		return err
	}
	fmt.Printf("%s\n", mdDumpReplaceAll(extraDump, replacements))

	fmt.Print("Private metadata\n")
	fmt.Print("----------------\n")
	pmdDump, err := libkbfs.DumpPrivateMetadata(config.Codec(), *rmd.Data())
	if err != nil {
		return err
	}
	fmt.Printf("%s", mdDumpReplaceAll(pmdDump, replacements))

	return nil
}

func mdDumpImmutableRMD(ctx context.Context, config libkbfs.Config,
	rmd libkbfs.ImmutableRootMetadata) error {
	fmt.Printf("MD ID: %s\n", rmd.MdID())

	return mdDumpReadOnlyRMD(ctx, config, rmd.ReadOnly())
}

const mdDumpUsageStr = `Usage:
  kbfstool md dump input [inputs...]

Each input must be in the following format:

  TLF
  TLF:Branch
  TLF^Revision
  TLF:Branch^Revision

where TLF can be:

  - a TLF ID string (32 hex digits),
  - or a keybase TLF path (e.g., "/keybase/public/user1,user2", or
    "/keybase/private/user1,assertion2");

Branch can be:

  - a Branch ID string (32 hex digits),
  - the string "device", which indicates the unmerged branch for the
    current device, or the master branch if there is no unmerged branch,
  - the string "master", which is a shorthand for
    the ID of the master branch "00000000000000000000000000000000", or
  - omitted, in which case it is treated as if it were the string "device";

and Revision can be:

  - a hex number prefixed with "0x",
  - a decimal number with no prefix,
  - the string "latest", which indicates the latest revision for the
    branch, or
  - omitted, in which case it is treated as if it were the string "latest".

`

func mdDump(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs md dump", flag.ContinueOnError)
	err := flags.Parse(args)
	if err != nil {
		printError("md dump", err)
		return 1
	}

	inputs := flags.Args()
	if len(inputs) < 1 {
		fmt.Print(mdDumpUsageStr)
		return 1
	}

	for _, input := range inputs {
		irmd, err := mdParseAndGet(ctx, config, input)
		if err != nil {
			printError("md dump", err)
			return 1
		}

		if irmd == (libkbfs.ImmutableRootMetadata{}) {
			fmt.Printf("No result found for %q\n\n", input)
			continue
		}

		fmt.Printf("Result for %q:\n\n", input)

		err = mdDumpImmutableRMD(ctx, config, irmd)
		if err != nil {
			printError("md dump", err)
			return 1
		}

		fmt.Print("\n")
	}

	return 0
}
