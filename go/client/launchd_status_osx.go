// +build darwin

package client

import (
	"fmt"
	"path"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func KeybaseServiceStatus(g *libkb.GlobalContext, bundleVersion string) keybase1.ServiceStatus {
	serviceLabel := libkb.DefaultServiceLabel(libkb.KeybaseServiceID, libkb.DefaultRunMode)
	kbService := launchd.NewService(serviceLabel)
	kbLaunchdStatus, err := kbService.Status()
	if err != nil {
		return errorStatus(err)
	}

	if kbLaunchdStatus == nil {
		return keybase1.ServiceStatus{InstallStatus: keybase1.InstallStatus_NOT_INSTALLED}
	}

	var config keybase1.Config
	if kbLaunchdStatus.Pid() != "" {

		runtimeDir := g.Env.GetRuntimeDir()
		_, err := libkb.WaitForServiceInfoFile(path.Join(runtimeDir, "keybased.info"), kbLaunchdStatus.Pid(), 5, 500*time.Millisecond, "launchd status for service")
		if err != nil {
			return errorStatus(err)
		}

		configClient, err := GetConfigClient(g)
		if err != nil {
			return errorStatus(err)
		}

		config, err = configClient.GetConfig(context.TODO(), 0)
		if err != nil {
			return errorStatus(err)
		}

		if config.Label != kbLaunchdStatus.Label() {
			return errorStatus(fmt.Errorf("Service label mismatch: %s != %s", config.Label, kbLaunchdStatus.Label()))
		}
	}

	version := config.Version
	buildVersion := libkb.VersionString()

	st := keybase1.ServiceStatus{
		Version:        config.Version,
		Label:          kbLaunchdStatus.Label(),
		Pid:            kbLaunchdStatus.Pid(),
		LastExitStatus: kbLaunchdStatus.LastExitStatus(),
		BundleVersion:  bundleVersion,
	}

	// Something must be wrong if this build doesn't match the package version.
	if bundleVersion != buildVersion {
		st.InstallStatus = keybase1.InstallStatus_ERROR
		st.Error = &keybase1.ServiceStatusError{Message: fmt.Sprintf("Bundle version mismatch: %s != %s", bundleVersion, buildVersion)}
		return st
	}

	installStatus, se := installStatus(version, bundleVersion)
	st.InstallStatus = installStatus
	st.Error = se
	return st
}

func KBFSServiceStatus(g *libkb.GlobalContext, bundleVersion string) keybase1.ServiceStatus {
	serviceLabel := libkb.DefaultServiceLabel(libkb.KBFSServiceID, libkb.DefaultRunMode)
	kbfsService := launchd.NewService(serviceLabel)
	kbfsLaunchdStatus, err := kbfsService.Status()
	if err != nil {
		return errorStatus(err)
	}

	if kbfsLaunchdStatus == nil {
		return keybase1.ServiceStatus{InstallStatus: keybase1.InstallStatus_NOT_INSTALLED}
	}

	runtimeDir := g.Env.GetRuntimeDir()
	kbfsInfo, err := libkb.WaitForServiceInfoFile(path.Join(runtimeDir, "kbfs.info"), kbfsLaunchdStatus.Pid(), 5, 500*time.Millisecond, "launchd status for kbfs")
	if err != nil {
		return errorStatus(err)
	}
	// nil means file wasn't found
	if kbfsInfo == nil {
		kbfsInfo = &libkb.ServiceInfo{}
	}

	version := kbfsInfo.Version

	st := keybase1.ServiceStatus{
		Version:        version,
		Label:          kbfsLaunchdStatus.Label(),
		Pid:            kbfsLaunchdStatus.Pid(),
		LastExitStatus: kbfsLaunchdStatus.LastExitStatus(),
		BundleVersion:  bundleVersion,
	}

	installStatus, se := installStatus(version, bundleVersion)
	st.InstallStatus = installStatus
	st.Error = se
	return st
}

func installStatus(version string, bundleVersion string) (keybase1.InstallStatus, *keybase1.ServiceStatusError) {
	var installStatus keybase1.InstallStatus
	installStatus = keybase1.InstallStatus_UNKNOWN
	if version != "" && bundleVersion != "" {
		sv, err := semver.Make(version)
		if err != nil {
			return keybase1.InstallStatus_ERROR, &keybase1.ServiceStatusError{Message: err.Error()}
		}
		bsv, err := semver.Make(bundleVersion)
		if err != nil {
			return keybase1.InstallStatus_ERROR, &keybase1.ServiceStatusError{Message: err.Error()}
		}
		if bsv.GT(sv) {
			installStatus = keybase1.InstallStatus_NEEDS_UPGRADE
		} else if bsv.EQ(sv) {
			installStatus = keybase1.InstallStatus_INSTALLED
		} else if bsv.LT(sv) {
			return keybase1.InstallStatus_ERROR, &keybase1.ServiceStatusError{Message: fmt.Sprintf("Bundle version (%s) is less than installed version (%s)", bundleVersion, version)}
		}
	}
	return installStatus, nil
}

func errorStatus(err error) keybase1.ServiceStatus {
	return keybase1.ServiceStatus{
		InstallStatus: keybase1.InstallStatus_ERROR,
		Error: &keybase1.ServiceStatusError{
			Message: err.Error(),
		},
	}
}

func DiagnoseSocketError(err error) {
	services, err := launchd.ListServices("keybase.")
	if err != nil {
		GlobUI.Printf("Error checking launchd services: %v\n\n", err)
		return
	}

	if len(services) == 0 {
		GlobUI.Println("\nThere are no Keybase services installed. You may need to re-install.")
	} else if len(services) > 1 {
		GlobUI.Println("\nWe found multiple services:")
		for _, service := range services {
			GlobUI.Println("  " + service.StatusDescription())
		}
		GlobUI.Println("")
	} else if len(services) == 1 {
		service := services[0]
		status, err := service.Status()
		if err != nil {
			G.Log.Errorf("Error checking service status(%s): %v\n\n", service.Label(), err)
		} else {
			if status == nil || !status.IsRunning() {
				GlobUI.Printf("\nWe found a Keybase service (%s) but it's not running.\n", service.Label())
				cmd := fmt.Sprintf("keybase launchd start %s", service.Label())
				GlobUI.Println("You might try starting it: " + cmd + "\n")
			} else {
				GlobUI.Printf("\nWe couldn't connect but there is a Keybase service (%s) running (%s).\n", status.Label(), status.Pid())
				cmd := fmt.Sprintf("keybase launchd restart %s", service.Label())
				GlobUI.Println("You might try restarting it: " + cmd + "\n")
			}
		}
	}
}
