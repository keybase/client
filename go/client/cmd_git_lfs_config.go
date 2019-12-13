package client

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"runtime"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

const (
	gitURLPrefix = "keybase://"
)

type CmdGitLFSConfig struct {
	libkb.Contextified
	path string
	repo string
}

func newCmdGitLFSConfig(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:        "lfs-config",
		Usage:       "Configures a keybase git checkout to use LFS",
		Description: "Git LFS (Large File Storage) is a git extension that keeps pointers to\n   large files within your git repository, but the files themselves are stored\n   externally.  KBFS supports being the external storage for LFS, and running\n   this command in a checkout will configure it to use KBFS for LFS.\n   To install Git LFS, see https://git-lfs.github.com.",
		Action: func(c *cli.Context) {
			cmd := NewCmdGitLFSConfigRunner(g)
			cl.ChooseCommand(cmd, "lfs-config", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "path",
				Usage: "Location of local git checkout (default: current working dir)",
			},
			cli.StringFlag{
				Name:  "repo",
				Usage: "Keybase repo URL (default: first keybase remote URL in checkout)",
			},
		},
	}
}

func NewCmdGitLFSConfigRunner(g *libkb.GlobalContext) *CmdGitLFSConfig {
	return &CmdGitLFSConfig{Contextified: libkb.NewContextified(g)}
}

func (c *CmdGitLFSConfig) ParseArgv(ctx *cli.Context) error {
	c.path = ctx.String("path")
	c.repo = ctx.String("repo")
	if c.repo != "" && !strings.HasPrefix(c.repo, gitURLPrefix) {
		return fmt.Errorf("%s is not a valid Keybase repo", c.repo)
	}
	return nil
}

func (c *CmdGitLFSConfig) gitExec(command ...string) (string, error) {
	path := []string{}
	if c.path != "" {
		path = []string{"-C", c.path}
	}
	cmd := exec.Command("git",
		append(path, command...)...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func (c *CmdGitLFSConfig) getRepo() (string, error) {
	if c.repo != "" {
		return c.repo, nil
	}

	// Use the first keybase:// link by default.
	output, err := c.gitExec("remote", "-v")
	if err != nil {
		return "", err
	}
	reader := bytes.NewBufferString(output)
	for {
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			return "", errors.New("No keybase remote found")
		} else if err != nil {
			return "", err
		}

		s := strings.Fields(line)
		if len(s) < 2 {
			continue
		}
		if strings.HasPrefix(s[1], gitURLPrefix) {
			return s[1], nil
		}
	}
}

func (c *CmdGitLFSConfig) Run() error {
	dui := c.G().UI.GetDumbOutputUI()

	// Find the repo URL.
	repo, err := c.getRepo()
	if err != nil {
		return err
	}

	// Add the necessary lfs config.
	_, err = c.gitExec(
		"config", "--add", "lfs.standalonetransferagent", "keybase-lfs")
	if err != nil {
		return err
	}
	_, err = c.gitExec(
		"config", "--add", "lfs.customtransfer.keybase-lfs.path",
		"git-remote-keybase")
	if err != nil {
		return err
	}
	// Note that the "origin" here as a remote name doesn't really
	// matter, since git-remote-keybase doesn't use it for anything
	// when in LFS mode.  It's only there because it's expected in the
	// argument list.
	quoteArgs := ""
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		// Windows and macOS require quotes around the args, but linux
		// does not.
		quoteArgs = "\""
	}
	_, err = c.gitExec(
		"config", "--add", "lfs.customtransfer.keybase-lfs.args",
		fmt.Sprintf("%slfs origin %s%s", quoteArgs, repo, quoteArgs))
	if err != nil {
		return err
	}

	repoString := "This repo"
	if c.path != "" {
		repoString = "The repo at " + c.path
	}
	dui.Printf("Success! %s is now configured to use the following Keybase\nrepository for LFS:\n", repoString)
	dui.Printf("\t%s\n\n", repo)
	dui.Printf("Assuming you have installed Git LFS (see https://git-lfs.github.com) you can now\nconfigure git to store certain files directly in Keybase.  For example:\n")
	dui.Printf("\tgit lfs install\n")
	dui.Printf("\tgit lfs track \"*.zip\"\n")
	dui.Printf("\tgit add .gitattributes\n\n")
	dui.Printf("Note that new checkouts of this repository will see a \"missing protocol\" error\nuntil you have configured it with this `keybase git lfs-config` command.  After\ndoing so, you can sync the LFS files with this command:\n")
	dui.Printf("\tgit checkout -f HEAD\n")
	return nil
}

func (c *CmdGitLFSConfig) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
