package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"

	"github.com/keybase/client/packaging/linux/tuxbot/bot/access"
	"github.com/keybase/client/packaging/linux/tuxbot/bot/chatbot"
	"github.com/keybase/client/packaging/linux/tuxbot/bot/common"
	"github.com/keybase/go-keybase-chat-bot/kbchat"
	"github.com/keybase/go-keybase-chat-bot/kbchat/types/chat1"

	"github.com/docker/docker/client"
	"github.com/pkg/errors"
	"github.com/subosito/gotenv"
)

const dockerNamespace = "keybaseio/client"

type Tuxbot struct {
	chatbot.Logger
	docker *client.Client

	Name                   string
	sendChannel            chat1.ChatChannel
	acl                    access.ACL
	api                    *kbchat.API
	Locked                 bool
	codeSigningFingerprint string

	dockerUsername string
	dockerPassword string

	archiveTeam string
}

var _ chatbot.Bot = (*Tuxbot)(nil)

func (c Tuxbot) API() *kbchat.API {
	return c.api
}

func (c Tuxbot) SourceDirectory() string {
	// Disallow autoupdates for tuxbot
	return ""
}

func (c Tuxbot) ACL() access.ACL {
	return c.acl
}

func (c Tuxbot) WarnOnCrash() bool {
	return false
}

func makeCmd(currentUser *user.User, proc string, args ...string) *exec.Cmd {
	cmd := exec.Command(proc, args...)
	cmd.Dir = filepath.Join(currentUser.HomeDir, "client")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	return cmd
}

func (c Tuxbot) DispatchReaction(chat1.MsgSummary, string) (err error) { return nil }
func (c Tuxbot) Dispatch(msg chat1.MsgSummary, args []string) (err error) {
	if len(args) < 1 || !strings.HasPrefix(args[0], "!") {
		return nil
	}
	command := args[0][1:]
	args = args[1:]

	// Defer deferment so we don't spam logs with non-commands
	cmd := fmt.Sprintf("%s(%s)", command, strings.Join(args, ", "))
	defer chatbot.InfoTraceVerbose(c, cmd, func() (interface{}, error) { return nil, err })()

	currentUser, err := user.Current()
	if err != nil {
		return err
	}

	switch command {
	case "help":
		c.Info("`release revision?, nightly revision?, test revision?, tuxjournal, journal, archive revision, build-docker revision?, release-docker tag`")
		return nil
	case "archive":
		if len(args) < 1 {
			return fmt.Errorf("need a revision (e.g. !archive v4.0.0)")
		}

		revision := args[0]
		c.Info("Generating release artifacts for %s", revision)

		err = makeCmd(currentUser, "git", "checkout", "-f", "master").Run()
		if err != nil {
			return err
		}

		err = makeCmd(currentUser, "git", "pull", "--ff-only").Run()
		if err != nil {
			return err
		}

		archiveCmd := exec.Command("git", "archive", "--format=tar", fmt.Sprintf("--prefix=client-%s/", revision), revision)
		archiveCmd.Dir = filepath.Join(currentUser.HomeDir, "client")
		xzCmd := exec.Command("xz")

		archiveName := fmt.Sprintf("/keybase/team/%s/keybase-%s.tar.xz", c.archiveTeam, revision)
		archiveHandle, err := os.OpenFile(archiveName, os.O_RDWR|os.O_CREATE, 0644)
		if err != nil {
			return err
		}
		defer archiveHandle.Close()
		sigHandle, err := os.OpenFile(archiveName+".sig", os.O_RDWR|os.O_CREATE, 0644)
		if err != nil {
			return err
		}
		defer sigHandle.Close()

		r, w := io.Pipe()
		var archiveErr bytes.Buffer
		var xzErr bytes.Buffer
		archiveCmd.Stdout = w
		xzCmd.Stdin = r
		xzCmd.Stdout = archiveHandle
		archiveCmd.Stderr = &archiveErr
		xzCmd.Stderr = &xzErr

		c.Info("Building tarball into %s", archiveHandle.Name())
		err = archiveCmd.Start()
		if err != nil {
			return err
		}
		err = xzCmd.Start()
		if err != nil {
			return err
		}
		err = archiveCmd.Wait()
		if err != nil {
			return errors.Wrap(err, archiveErr.String())
		}
		w.Close()
		err = xzCmd.Wait()
		if err != nil {
			return errors.Wrap(err, xzErr.String())
		}
		c.Info("Tarball built at %s", archiveHandle.Name())

		c.Info("Signing tarball")
		gpgCmd := exec.Command("gpg", "--batch", "--yes", "--detach-sign", "--armor", "--use-agent",
			"--local-user", c.codeSigningFingerprint, "-o", sigHandle.Name(), archiveHandle.Name())
		ret, err := gpgCmd.CombinedOutput()
		if err != nil {
			return errors.Wrap(err, string(ret))
		}
		c.Info("Signed tarball at %s", sigHandle.Name())

		return nil
	case "release", "nightly", "test":
		c.Info("Building Linux %s...", command)
		if c.Locked {
			return fmt.Errorf("locked by another command; aborting")
		}

		err = makeCmd(currentUser, "git", "checkout", "-f", "surya/eveneven-more-vagrant").Run()
		if err != nil {
			return err
		}

		err = makeCmd(currentUser, "git", "pull", "--ff-only").Run()
		if err != nil {
			return err
		}

		commit := "HEAD"
		if len(args) > 0 {
			commit = args[0]
		}

		c.Locked = true
		go func() {
			defer func() {
				c.Locked = false
			}()
			c.Info("Using commit %s...", commit)
			cmd := makeCmd(currentUser, "./packaging/linux/docker_build.sh", "prerelease", commit)
			if command == "nightly" {
				cmd.Env = append(cmd.Env, "KEYBASE_NIGHTLY=1")
			}
			if command == "test" {
				cmd.Env = append(cmd.Env, "KEYBASE_TEST=1")
			}
			if command == "release" {
				cmd.Env = append(cmd.Env, "KEYBASE_RELEASE=1")
			}
			val, ok := os.LookupEnv("KEYBASE_TEST_CODE_SIGNING_KEY")
			if ok {
				cmd.Env = append(cmd.Env, "KEYBASE_TEST_CODE_SIGNING_KEY="+val)
			}
			err = cmd.Run()
			if err != nil {
				c.Info("error: %s", err)
				if _, err := c.API().SendMessage(c.sendChannel, "!tuxjournal"); err != nil {
					c.Info("error: %s", err)
				}
				return
			}

			c.Info("@%s Build succeeded", msg.Sender.Username)
			switch command {
			case "release":
				c.Info("deb: https://prerelease.keybase.io/keybase_amd64.deb, rpm: https://prerelease.keybase.io/keybase_amd64.rpm")
			case "nightly":
				c.Info("deb: https://prerelease.keybase.io/nightly/keybase_amd64.deb, rpm: https://prerelease.keybase.io/nightly/keybase_amd64.rpm")
			case "test":
				c.Info("deb: https://s3.amazonaws.com/tests.keybase.io/linux_binaries/deb/index.html, rpm: https://s3.amazonaws.com/tests.keybase.io/linux_binaries/rpm/index.html")
			}

			// Only build Docker images if it's release or nightly.
			if command == "test" {
				return
			}

			if _, err := c.API().SendMessage(c.sendChannel, "!build-docker "+strings.Join(args, " ")); err != nil {
				c.Debug("unable to SendMessage: %v", err)
			}
		}()
		return nil
	case "build-docker", "docker-build":
		c.Info("Building Linux %s...", command)
		if c.Locked {
			return fmt.Errorf("locked by another command; aborting")
		}

		err = makeCmd(currentUser, "git", "checkout", "-f", "master").Run()
		if err != nil {
			return err
		}

		err = makeCmd(currentUser, "git", "pull", "--ff-only").Run()
		if err != nil {
			return err
		}

		commit := "HEAD"
		if len(args) > 0 {
			commit = args[0]
		}
		c.Locked = true
		go func() {
			defer func() {
				c.Locked = false
			}()
			c.Info("Using commit %s...", commit)

			if err := makeCmd(currentUser, "git", "checkout", "-f", commit).Run(); err != nil {
				c.Info("checkout error: %v", err)
				return
			}

			// Get the version as it's easier to do it here'
			versionCmd := makeCmd(currentUser, "./packaging/version.sh", "prerelease")
			versionCmd.Stdout = nil
			versionCmd.Stderr = nil
			versionOutput, err := versionCmd.Output()
			if err != nil {
				c.Info("error during determining the version: %s", err)
				return
			}
			var (
				trimmedVersionOutput = strings.TrimSpace(string(versionOutput))
				versionTag           = strings.Replace(trimmedVersionOutput, "+", "-", -1)
			)

			// Do the actual build
			buildCmd := makeCmd(
				currentUser,
				"./packaging/linux/docker/build.sh",
				trimmedVersionOutput,
			)
			buildCmd.Stdout = nil
			buildCmd.Stderr = nil
			output, err := buildCmd.CombinedOutput()
			if err != nil {
				var trimmedOutput []byte
				if len(output) > 500 {
					trimmedOutput = output[len(output)-500:]
				} else {
					trimmedOutput = output
				}
				c.Info("docker build error: %v", err)
				c.Info("Logs:\n%s", string(trimmedOutput))
				return
			}

			// Validate that we generated 2 images
			var (
				ctx         = context.Background()
				standardTag = dockerNamespace + ":" + versionTag
				slimTag     = dockerNamespace + ":" + versionTag + "-slim"
				nodeTag     = dockerNamespace + ":" + versionTag + "-node"
				nodeSlimTag = dockerNamespace + ":" + versionTag + "-node-slim"
			)
			if !c.imageExists(ctx, standardTag) {
				c.Info("Image %s not found. Aborting the release.", standardTag)
				return
			}
			if !c.imageExists(ctx, slimTag) {
				c.Info("Image %s not found. Aborting the release.", slimTag)
				return
			}
			if !c.imageExists(ctx, nodeTag) {
				c.Info("Image %s not found. Aborting the release.", nodeTag)
				return
			}
			if !c.imageExists(ctx, nodeSlimTag) {
				c.Info("Image %s not found. Aborting the release.", nodeSlimTag)
				return
			}

			// We're doing a bunch of tagging here
			if err := c.tagAndPush(ctx, [][2]string{
				{"", standardTag},
				{"", slimTag},
				{"", nodeTag},
				{"", nodeSlimTag},
				{standardTag, dockerNamespace + ":nightly"},
				{slimTag, dockerNamespace + ":nightly-slim"},
				{nodeTag, dockerNamespace + ":nightly-node"},
				{nodeSlimTag, dockerNamespace + ":nightly-node-slim"},
			}); err != nil {
				c.Info("Docker push aborted: %v", err)
				return
			}
			c.Info(
				"@%s Released Docker tag %s, available as the following images:\n - %s\n - %s\n - %s\n - %s",
				msg.Sender.Username, versionTag, standardTag, slimTag, nodeTag, nodeSlimTag,
			)
		}()
		return nil
	case "release-docker":
		if len(args) == 0 {
			if _, err := c.API().SendMessage(c.sendChannel, "Usage: !release-docker [tag]"); err != nil {
				c.Debug("unable SendMessage: %v", err)
			}
			return nil
		}

		// Make sure that both the images exist
		var (
			ctx         = context.Background()
			versionTag  = strings.Replace(args[0], "+", "-", -1)
			standardTag = dockerNamespace + ":" + versionTag
			slimTag     = dockerNamespace + ":" + versionTag + "-slim"
			nodeTag     = dockerNamespace + ":" + versionTag + "-node"
			nodeSlimTag = dockerNamespace + ":" + versionTag + "-node-slim"
		)
		if !c.imageExists(ctx, standardTag) {
			c.Info("Image %s not found. Aborting.", standardTag)
			return nil
		}
		if !c.imageExists(ctx, slimTag) {
			c.Info("Image %s not found. Aborting.", slimTag)
			return nil
		}
		if !c.imageExists(ctx, nodeTag) {
			c.Info("Image %s not found. Aborting.", nodeTag)
			return nil
		}
		if !c.imageExists(ctx, nodeSlimTag) {
			c.Info("Image %s not found. Aborting.", nodeSlimTag)
			return nil
		}

		// First part of the arg before a "-" is the proper version number
		var (
			tagParts     = strings.Split(versionTag, "-")
			versionPlain = tagParts[0]
		)

		// Promoting to a Docker release is pretty much just tagging the images
		if err := c.tagAndPush(ctx, [][2]string{
			{standardTag, dockerNamespace + ":stable"},
			{standardTag, dockerNamespace + ":latest"},
			{standardTag, dockerNamespace + ":" + versionPlain},
			{slimTag, dockerNamespace + ":stable-slim"},
			{slimTag, dockerNamespace + ":latest-slim"},
			{slimTag, dockerNamespace + ":" + versionPlain + "-slim"},
			{nodeTag, dockerNamespace + ":stable-node"},
			{nodeTag, dockerNamespace + ":latest-node"},
			{nodeTag, dockerNamespace + ":" + versionPlain + "-node"},
			{nodeSlimTag, dockerNamespace + ":stable-node-slim"},
			{nodeSlimTag, dockerNamespace + ":latest-node-slim"},
			{nodeSlimTag, dockerNamespace + ":" + versionPlain + "-node-slim"},
		}); err != nil {
			c.Info("Docker push aborted: %v", err)
			return nil
		}
		if _, err := c.API().SendMessage(c.sendChannel, fmt.Sprintf("Released %s on Docker Hub.", versionPlain)); err != nil {
			c.Debug("unable to SendMessage: %v", err)
		}
		return nil
	case "tuxjournal":
		ret, _ := exec.Command("sudo", "journalctl", "--user-unit", "tuxbot", "-n", "50").CombinedOutput()
		c.Debug("```%s```", ret)
		return nil
	case "journal":
		ret, _ := exec.Command("sudo", "journalctl", "-n", "50").CombinedOutput()
		c.Debug("```%s```", ret)
		return nil
	default:
		return fmt.Errorf("invalid command %s", command)
	}
}

func main() {
	gotenv.Load(fmt.Sprintf("/keybase/team/%s/.kbfs_autogit/%s/keybot.env", os.Getenv("SECRETS_TEAM"), os.Getenv("SECRETS_REPO")))

	keybaseBinaryPath := flag.String("keybase-bin-path", "keybase", "the location of the keybase app")
	botName := flag.String("bot-name", "tuxbot", "the name of this bot")
	_ = flag.String("listen-team", os.Getenv("CHAT_TEAM"), "team name to listen to")
	_ = flag.String("listen-channel", os.Getenv("CHAT_CHANNEL"), "channel name to listen to")
	debugTeam := flag.String("debug-team", os.Getenv("CHAT_TEAM"), "team name to debug to")
	debugChannel := flag.String("debug-channel", os.Getenv("CHAT_CHANNEL"), "channel name to debug to")
	infoTeam := flag.String("info-team", os.Getenv("CHAT_TEAM"), "team name to info to")
	infoChannel := flag.String("info-channel", os.Getenv("CHAT_CHANNEL"), "channel name to info to")
	dockerUsername := flag.String("docker-username", os.Getenv("DOCKERHUB_USERNAME"), "docker hub bot username")
	dockerPassword := flag.String("docker-password", os.Getenv("DOCKERHUB_PASSWORD"), "docker hub bot password")
	flag.Parse()

	fmt.Println("Initializing...")
	api, err := chatbot.MakeAPI(*keybaseBinaryPath)
	if err != nil {
		panic(err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		panic(err)
	}

	if *infoTeam == "" || *infoChannel == "" {
		panic(fmt.Errorf("Chat team/channel specified: infoTeam=%q; infoChannel=%q", *infoTeam, *infoChannel))
	}

	debugC := chatbot.NewTeamChannel(*debugTeam, *debugChannel)
	infoC := chatbot.NewTeamChannel(*infoTeam, *infoChannel)
	logger := chatbot.ChatLogger{API: api, Name: *botName, DebugChannel: debugC, InfoChannel: infoC}

	tuxbot := Tuxbot{
		Logger: logger,
		docker: cli,

		Name:                   *botName,
		api:                    api,
		sendChannel:            infoC,
		acl:                    common.SimpleTuxbotACL(infoC),
		codeSigningFingerprint: "222B85B0F90BE2D24CFEB93F47484E50656D16C7",

		dockerUsername: *dockerUsername,
		dockerPassword: *dockerPassword,

		archiveTeam: *infoTeam,
	}

	if err := chatbot.Listen(tuxbot); err != nil {
		panic(err)
	}
}
