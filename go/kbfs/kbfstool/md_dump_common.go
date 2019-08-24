package main

import (
	"fmt"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// replacementMap is a map from a string to its replacement, intended
// to provide human-readable strings to UIDs and KIDs. It is usually
// created once per invocation and plumbed through everything that
// uses it, filling it on-demand so as to avoid needless calls to the
// service.
type replacementMap map[string]string

func mdDumpGetDeviceStringForCryptPublicKey(k kbfscrypto.CryptPublicKey, ui idutil.UserInfo) (
	string, bool) {
	deviceName, ok := ui.KIDNames[k.KID()]
	if !ok {
		return "", false
	}

	if revokedInfo, ok := ui.RevokedCryptPublicKeys[k]; ok {
		return fmt.Sprintf("%s (revoked %s) (kid:%s)",
			deviceName, revokedInfo.Time.Time(), k), true
	}

	return fmt.Sprintf("%s (kid:%s)", deviceName, k), true
}

func mdDumpGetDeviceStringForVerifyingKey(k kbfscrypto.VerifyingKey, ui idutil.UserInfo) (
	string, bool) {
	deviceName, ok := ui.KIDNames[k.KID()]
	if !ok {
		return "", false
	}

	if revokedInfo, ok := ui.RevokedVerifyingKeys[k]; ok {
		return fmt.Sprintf("%s (revoked %s) (kid:%s)",
			deviceName, revokedInfo.Time.Time(), k), true
	}

	return fmt.Sprintf("%s (kid:%s)", deviceName, k), true
}

func mdDumpFillReplacements(ctx context.Context, codec kbfscodec.Codec,
	service libkbfs.KeybaseService, osg idutil.OfflineStatusGetter,
	prefix string, rmd kbfsmd.RootMetadata, extra kbfsmd.ExtraMetadata,
	replacements replacementMap) error {
	writers, readers, err := rmd.GetUserDevicePublicKeys(extra)
	if err != nil {
		return err
	}

	offline := osg.OfflineAvailabilityForID(rmd.TlfID())

	for _, userKeys := range []kbfsmd.UserDevicePublicKeys{writers, readers} {
		for u := range userKeys {
			// Make sure to only make one Resolve and one
			// LoadUserPlusKeys call per user for a single
			// replacements map.
			if _, ok := replacements[u.String()]; ok {
				continue
			}

			username, _, err := service.Resolve(
				ctx, fmt.Sprintf("uid:%s", u),
				keybase1.OfflineAvailability_NONE)
			if err == nil {
				replacements[u.String()] = fmt.Sprintf(
					"%s (uid:%s)", username, u)
			} else {
				replacements[u.String()] = fmt.Sprintf(
					"<unknown username> (uid:%s)", u)
				printError(prefix, err)
			}

			ui, err := service.LoadUserPlusKeys(ctx, u, "", offline)
			if err != nil {
				printError(prefix, err)
				continue
			}

			for _, k := range ui.CryptPublicKeys {
				if _, ok := replacements[k.String()]; ok {
					continue
				}

				if deviceStr, ok := mdDumpGetDeviceStringForCryptPublicKey(k, ui); ok {
					replacements[k.String()] = deviceStr
				}
			}

			for k := range ui.RevokedCryptPublicKeys {
				if _, ok := replacements[k.String()]; ok {
					continue
				}

				if deviceStr, ok := mdDumpGetDeviceStringForCryptPublicKey(k, ui); ok {
					replacements[k.String()] = deviceStr
				}
			}

			for _, k := range ui.VerifyingKeys {
				if _, ok := replacements[k.String()]; ok {
					continue
				}

				if deviceStr, ok := mdDumpGetDeviceStringForVerifyingKey(k, ui); ok {
					replacements[k.String()] = deviceStr
				}
			}

			for k := range ui.RevokedVerifyingKeys {
				if _, ok := replacements[k.String()]; ok {
					continue
				}

				if deviceStr, ok := mdDumpGetDeviceStringForVerifyingKey(k, ui); ok {
					replacements[k.String()] = deviceStr
				}
			}
		}
	}

	return nil
}

func mdDumpReplaceAll(s string, replacements replacementMap) string {
	for old, new := range replacements {
		s = strings.Replace(s, old, new, -1)
	}
	return s
}

func mdDumpReadOnlyRMDWithReplacements(
	ctx context.Context, codec kbfscodec.Codec,
	replacements replacementMap, rmd libkbfs.ReadOnlyRootMetadata) error {
	c := spew.NewDefaultConfig()
	c.Indent = "  "
	c.DisablePointerAddresses = true
	c.DisableCapacities = true
	c.SortKeys = true

	fmt.Print("Root metadata\n")
	fmt.Print("-------------\n")

	brmdDump, err := kbfsmd.DumpRootMetadata(codec, rmd.GetBareRootMetadata())
	if err != nil {
		return err
	}

	fmt.Printf("%s\n", mdDumpReplaceAll(brmdDump, replacements))

	fmt.Print("Extra metadata\n")
	fmt.Print("--------------\n")
	extraDump, err := kbfsmd.DumpExtraMetadata(codec, rmd.Extra())
	if err != nil {
		return err
	}
	fmt.Printf("%s\n", mdDumpReplaceAll(extraDump, replacements))

	fmt.Print("Private metadata\n")
	fmt.Print("----------------\n")
	pmdDump, err := libkbfs.DumpPrivateMetadata(
		codec, len(rmd.GetSerializedPrivateMetadata()), *rmd.Data())
	if err != nil {
		return err
	}
	// Let the caller provide a trailing newline (if desired).
	fmt.Printf("%s", mdDumpReplaceAll(pmdDump, replacements))

	return nil
}

func mdDumpReadOnlyRMD(ctx context.Context, config libkbfs.Config,
	prefix string, replacements replacementMap,
	rmd libkbfs.ReadOnlyRootMetadata) error {
	err := mdDumpFillReplacements(
		ctx, config.Codec(), config.KeybaseService(), config,
		prefix, rmd.GetBareRootMetadata(), rmd.Extra(), replacements)
	if err != nil {
		printError(prefix, err)
	}

	return mdDumpReadOnlyRMDWithReplacements(
		ctx, config.Codec(), replacements, rmd)
}
