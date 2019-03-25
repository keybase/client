// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!windows

package client

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

const backtick = "`"

type CmdCtlAutostart struct {
	libkb.Contextified
	ToggleOn bool
}

func NewCmdCtlAutostart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdCtlAutostart{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "autostart",
		Usage: `Configure autostart settings via the XDG autostart standard.

	This creates a file at ~/.config/autostart/keybase.desktop.

	If you change this file after initial install, it will not be changed unless
	you run ` + backtick + `keybase ctl autostart` + backtick + ` or delete
	the sentinel file at ~/.config/keybase/autostart_created.

	If you are using a headless machine or a minimal window manager that doesn't
	respect this standard, you will need to configure autostart in another way.

	If you are running Keybase on a headless machine using systemd, you may be
	interested in enabling the systemd user manager units keybase.service and
	kbfs.service: ` + backtick + `systemctl --user enable keybase kbfs
	keybase-redirector` + backtick + `.
`,
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "enable",
				Usage: "Toggle on Keybase, KBFS, and GUI autostart on startup.",
			},
			cli.BoolFlag{
				Name:  "disable",
				Usage: "Toggle off Keybase, KBFS, and GUI autostart on startup.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "autostart", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdCtlAutostart) ParseArgv(ctx *cli.Context) error {
	toggleOn := ctx.Bool("enable")
	toggleOff := ctx.Bool("disable")
	if toggleOn && toggleOff {
		return fmt.Errorf("Cannot specify both --enable and --disable.")
	}
	if !toggleOn && !toggleOff {
		return fmt.Errorf("Must specify either --enable or --disable.")
	}
	c.ToggleOn = toggleOn
	return nil
}

func (c *CmdCtlAutostart) Run() error {
	err := install.ToggleAutostart(c.G(), c.ToggleOn, false)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdCtlAutostart) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

type CmdCtlRedirector struct {
	libkb.Contextified
	ToggleOn            bool
	Status              bool
	RootRedirectorMount string
	RootConfigFilename  string
	RootConfigDirectory string
}

func NewCmdCtlRedirector(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdCtlRedirector{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "redirector",
		Usage: `Configure keybase-redirector settings.

	This option requires root privileges, and must use the root config file
	at /etc/keybase/config.json.

	The Keybase redirector allows every user to access KBFS files at /keybase,
	which will show different information depending on the requester.

	Enabling the root redirector will set suid root on /usr/bin/keybase-redirector,
	allowing any user to run it with root privileges. It is enabled by default.

	If the redirector is disabled, you can still access your files in the mount
	directory given by ` + backtick + `keybase config get -d -b mountdir` + backtick + `,
	which is owned by your user, but you won't be able to access your files at
	/keybase.

	More information is available at
	https://keybase.io/docs/kbfs/understanding_kbfs#mountpoints.

	Examples (prepend sudo, if not root):
	` + backtick + backtick + backtick + `
	keybase --use-root-config-file ctl redirector --status
	keybase --use-root-config-file ctl redirector --enable
	keybase --use-root-config-file ctl redirector --disable
	` + backtick + backtick + backtick + `
`,
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "status",
				Usage: "Print whether the KBFS redirector is enabled or disabled.",
			},
			cli.BoolFlag{
				Name:  "enable",
				Usage: "Toggle on the KBFS redirector.",
			},
			cli.BoolFlag{
				Name:  "disable",
				Usage: "Toggle off the KBFS redirector.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "redirector", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func xor3(a, b, c bool) (ret bool) {
	ret = ret != a
	ret = ret != b
	ret = ret != c
	return ret
}

func (c *CmdCtlRedirector) ParseArgv(ctx *cli.Context) error {
	toggleOn := ctx.Bool("enable")
	toggleOff := ctx.Bool("disable")
	status := ctx.Bool("status")
	if !xor3(toggleOn, toggleOff, status) || (toggleOn && toggleOff && status) {
		return fmt.Errorf("Must specify exactly one of --enable, --disable, --status.")
	}
	c.ToggleOn = toggleOn
	c.Status = status

	return nil
}

func (c *CmdCtlRedirector) isRedirectorEnabled() (bool, error) {
	config := c.G().Env.GetConfig()
	if config == nil {
		return false, fmt.Errorf("could not get config reader")
	}

	i, err := config.GetInterfaceAtPath(libkb.DisableRootRedirectorConfigKey)
	if err != nil {
		// Config key or file nonexistent, but possibly other errors as well.
		return true, nil
	}
	val, ok := i.(bool)
	if !ok {
		return false, fmt.Errorf("config corruption: not a boolean value; please delete the %s key in %s manually.",
			libkb.DisableRootRedirectorConfigKey, c.RootConfigFilename)
	}
	return !val, nil
}

func redirectorPerm(toggleOn bool) uint32 {
	if toggleOn {
		// suid set; octal.
		return 04755
	}
	// suid unset; octal.
	return 0755
}

func (c *CmdCtlRedirector) createMount() error {
	rootMountPerm := os.FileMode(0755 | os.ModeDir)
	mountedPerm := os.FileMode(0555 | os.ModeDir) // permissions different when mounted
	fileInfo, err := os.Stat(c.RootRedirectorMount)
	switch {
	case os.IsNotExist(err):
		err := os.Mkdir(c.RootRedirectorMount, rootMountPerm)
		if err != nil {
			c.G().Log.Errorf("Failed to create mountpoint at %s: %s", c.RootRedirectorMount, err)
			return err
		}
		fmt.Println("Redirector mount created.")
	case err == nil:
		c.G().Log.Warning("Root mount already exists; will not re-create.")
		if fileInfo.Mode() != rootMountPerm && fileInfo.Mode() != mountedPerm {
			return fmt.Errorf("Root mount exists at %s, but has incorrect file mode %s. Delete %s and try again.",
				c.RootRedirectorMount, fileInfo.Mode(), c.RootRedirectorMount)
		}
		dir, err := os.Open(c.RootRedirectorMount)
		if err != nil {
			return fmt.Errorf("Root mount exists at %s, but failed to open: %s. Delete %s and try again.", c.RootRedirectorMount, err, c.RootRedirectorMount)
		}
		defer dir.Close()
		_, err = dir.Readdir(1)
		switch err {
		case io.EOF:
			// doesn't fall-through.
		case nil:
			return fmt.Errorf("Root mount exists at %s, but is non-empty (is the redirector currently running?). Run `# pkill -f keybase-redirector`, delete directory %s and try again.", c.RootRedirectorMount, c.RootRedirectorMount)
		default:
			return fmt.Errorf("Unexpected error while reading %s: %s", c.RootRedirectorMount, err)
		}
	default:
		c.G().Log.Errorf("Unexpected error while trying to stat mount: %s", err)
		return err
	}
	return nil
}

func (c *CmdCtlRedirector) deleteMount() error {
	err := os.Remove(c.RootRedirectorMount)
	switch {
	case os.IsNotExist(err):
		c.G().Log.Warning("Root mountdir already nonexistent.")
	case err == nil:
		fmt.Println("Redirector mount deletion successful.")
	default:
		c.G().Log.Errorf("Failed to delete mountpoint at %s: %s", c.RootRedirectorMount, err)
		c.G().Log.Errorf("If KBFS is not being used, run `# pkill -f keybase-redirector`, delete %s and try again.", c.RootRedirectorMount)
		return err
	}
	return nil
}

func (c *CmdCtlRedirector) tryAtomicallySetConfigAndChmodRedirector(originallyEnabled bool) error {
	configWriter := c.G().Env.GetConfigWriter()
	if configWriter == nil {
		return fmt.Errorf("could not get config writer")
	}

	// By default, writing a config file uses libkb.PermFile which is only readable by the creator.
	// Since we're writing to the root config file, re-allow other users to read it.
	defer func() {
		// Don't check if err != nil here, since we want this to run even if, e.g.,
		// the syscall.Chmod call failed.
		os.Chmod(c.RootConfigDirectory, 0755|os.ModeDir)
		os.Chmod(c.RootConfigFilename, 0644)
	}()

	err := configWriter.SetBoolAtPath(libkb.DisableRootRedirectorConfigKey, !c.ToggleOn)
	if err != nil {
		c.G().Log.Errorf("Failed to write to %s. Do you have root privileges?", c.RootConfigFilename)
		return err
	}

	redirectorPath, err := exec.LookPath("keybase-redirector")
	if err != nil {
		c.G().Log.Warning("configuration successful, but keybase-redirector not found in $PATH (it may not be installed), so not updating permissions.")
		return nil
	}

	// os.Chmod doesn't work with suid bit, so use syscall.
	err = syscall.Chmod(redirectorPath, redirectorPerm(c.ToggleOn))
	if err != nil {
		// If flipping bit, attempt to restore old config value to maintain consistency between config and redirector mode.
		if originallyEnabled != c.ToggleOn {
			configErr := configWriter.SetBoolAtPath(libkb.DisableRootRedirectorConfigKey, !originallyEnabled)
			if configErr != nil {
				c.G().Log.Errorf("Failed to revert config after chmod failure; config may be in inconsistent state.")
				return fmt.Errorf("Error during chmod: %s. Error during config revert: %s.", err, configErr)
			}
		}

		return err
	}

	return nil
}

func (c *CmdCtlRedirector) configureEnv() error {
	rootRedirectorMount, err := c.G().Env.GetRootRedirectorMount()
	if err != nil {
		return err
	}
	c.RootRedirectorMount = rootRedirectorMount

	rootConfigFilename, err := c.G().Env.GetRootConfigFilename()
	if err != nil {
		return err
	}
	c.RootConfigFilename = rootConfigFilename

	if c.RootConfigFilename != c.G().Env.GetConfigFilename() {
		return fmt.Errorf("Must specify --use-root-config-file to `keybase`.")
	}
	return nil
}

func (c *CmdCtlRedirector) Run() error {
	// Don't do this setup in ParseArgv because environment variables have not
	// yet been populated then.
	err := c.configureEnv()
	if err != nil {
		return err
	}

	rootConfigDirectory, err := c.G().Env.GetRootConfigDirectory()
	if err != nil {
		return err
	}
	c.RootConfigDirectory = rootConfigDirectory
	enabled, err := c.isRedirectorEnabled()
	if err != nil {
		return err
	}

	if c.Status {
		if enabled {
			fmt.Println("enabled")
		} else {
			fmt.Println("disabled")
		}
		return nil
	}

	err = c.tryAtomicallySetConfigAndChmodRedirector(enabled)
	if err != nil {
		return err
	}
	fmt.Println("Redirector configuration updated.")

	if c.ToggleOn {
		err := c.createMount()
		if err != nil {
			return err
		}
		fmt.Println("Please run `run_keybase` to start the redirector for each user using KBFS.")
	} else {
		err := c.deleteMount()
		if err != nil {
			return err
		}
		fmt.Println("Please run `# pkill -f keybase-redirector` to stop the redirector for all users.")
	}

	return nil
}

func (c *CmdCtlRedirector) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		AllowRoot: true,
	}
}

type CmdCtlInit struct {
	libkb.Contextified
	DryRun bool
}

func NewCmdCtlInit(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdCtlInit{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "init",
		Usage: `Set up initial Keybase configuration.

	Performed by ` + backtick + `run_keybase` + backtick + ` automatically.
	Execute this command first, preferably before each time Keybase is started, to
	avoid using run_keybase.

	Among other things, sets up a environment file for Keybase processes to use,
	which is needed in init systems like systemd which hide the user environment
	from its processes by default. If environment variables change, this command
	must be executed again.
`,
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "dry-run",
				Usage: "Print a human-readable description of what will occur without writing any changes to disk. Do not parse.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "init", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdCtlInit) ParseArgv(ctx *cli.Context) error {
	c.DryRun = ctx.Bool("dry-run")
	return nil
}

type EnvSetting struct {
	Name  string
	Value *string
	Unset bool
}

func (c *CmdCtlInit) Envs() []EnvSetting {
	strPtr := func(s string) *string { return &s }
	return []EnvSetting{
		// This is for the system tray icon in new versions of Ubuntu that do not use Unity.
		// See https://github.com/electron/electron/issues/10887.
		EnvSetting{Name: "XDG_CURRENT_DESKTOP", Value: strPtr("Unity")},

		// * This section is for the Keybase GUI.
		// Some older distros (e.g. Ubuntu 16.04) don't make X session variables
		// available to user units automatically. Whitelisting them is safer than
		// dumping the entire environment, even though there's a chance we might
		// miss something, because some environment variables might contain
		// passwords or keys. Hopefully this section won't be needed someday.
		// (Arch Linux doesn't need it today.)
		// See: graphical-session.target.
		EnvSetting{Name: "DISPLAY", Value: nil},
		EnvSetting{Name: "XAUTHORITY", Value: nil},

		// * This section is for the Keybase GUI.
		// The following enable CJK and other alternative input methods.
		// See https://github.com/keybase/client/issues/9861.
		EnvSetting{Name: "CLUTTER_IM_MODULE", Value: nil},
		EnvSetting{Name: "GTK_IM_MODULE", Value: nil},
		EnvSetting{Name: "QT_IM_MODULE", Value: nil},
		EnvSetting{Name: "QT4_IM_MODULE", Value: nil},
		EnvSetting{Name: "XMODIFIERS", Value: nil},

		// * This section is for the Keybase GUI.
		// Arbitrary environment variables from bashrc and similar aren't
		// automatically available in the systemd session, and users probably
		// didn't use pam to define their XDG directories. Export them just in
		// case.
		EnvSetting{Name: "XDG_DOWNLOAD_DIR", Value: nil},

		// * This section is for the service, KBFS, and the Keybase GUI.
		EnvSetting{Name: "XDG_CACHE_HOME", Value: nil},
		EnvSetting{Name: "XDG_CONFIG_HOME", Value: nil},
		EnvSetting{Name: "XDG_DATA_HOME", Value: nil},
		EnvSetting{Name: "XDG_RUNTIME_DIR", Value: nil},
		EnvSetting{Name: "DBUS_SESSION_BUS_ADDRESS", Value: nil},
	}
}

// We can't really use environment generators for this because...  If
// systemd version is before 233 (e.g., in Ubuntu 16.04 LTS), environment
// generators are unsupported.  Also, by design, environment generators are
// not able to get user environment variables which might be specified,
// e.g., in a interactive shell file (rather than in say pam_environment).
// Thus, we always manually create the environment file again. It should
// only be needed once during every login to populate that file, after
// that, as long as they don't change, systemctl will work without
// run_keybase. Work around by directly creating an environment file that
// unit files read. If a user really doesn't want to use run_keybase, they
// can specify their environment variables in a more standard way and
// import $DISPLAY and $KEYBASE_AUTOSTART into the user manager environment
// themselves, if the GUI is needed.  # (graphical-session.target doesn't
// have great support either) We don't do this *and* the environment
// generator because we don't want to pollute the user manager environment
// with bad data.  If stable, user can pipe this to a local config file to
// remove this need.
func (c *CmdCtlInit) RunEnv() error {
	envs := c.Envs()
	envfileName, err := c.G().Env.GetEnvfileName()
	if err != nil {
		return err
	}
	overrideEnvfileName, err := c.G().Env.GetOverrideEnvfileName()
	if err != nil {
		return err
	}
	s := "# Autogenerated by `keybase ctl init`; do not edit.\n"
	s += "# Only used when running Keybase via systemd user manager.\n"
	s += fmt.Sprintf("# To override individual variables, write to %s\n", overrideEnvfileName)
	for _, env := range envs {
		if env.Value == nil {
			val, ok := os.LookupEnv(env.Name)
			env.Value = &val
			env.Unset = !ok
		}
		if env.Unset {
			s += fmt.Sprintf("# %s (unset)\n", env.Name)
		} else {
			s += fmt.Sprintf("%s=%s\n", env.Name, *env.Value)
		}
	}
	if c.DryRun {
		fmt.Printf("Writing following text to %s...\n", envfileName)
		fmt.Print(s)
	} else {
		dir, err := c.G().Env.GetEnvFileDir()
		if err != nil {
			return err
		}
		err = os.MkdirAll(dir, 0755)
		if err != nil {
			return err
		}
		envfile, err := os.OpenFile(envfileName, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
		if err != nil {
			return err
		}
		_, err = envfile.WriteString(s)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *CmdCtlInit) Run() error {
	err := c.RunEnv()
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdCtlInit) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

type CmdCtlWantsSystemd struct {
	libkb.Contextified
}

func NewCmdCtlWantsSystemd(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdCtlWantsSystemd{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "wants-systemd",
		// no Usage to hide command
		// returns 0 iff systemd management is wanted
		Flags:        []cli.Flag{},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "wants-systemd", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdCtlWantsSystemd) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdCtlWantsSystemd) Run() error {
	// Modeless so output is given in devel
	on := c.G().Env.ModelessWantsSystemd()
	if !on {
		return fmt.Errorf("Systemd not wanted.")
	}
	return nil
}

func (c *CmdCtlWantsSystemd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
