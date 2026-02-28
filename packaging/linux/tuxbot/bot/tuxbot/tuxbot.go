package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"time"

	"github.com/keybase/client/packaging/linux/tuxbot/bot/access"
	"github.com/keybase/client/packaging/linux/tuxbot/bot/chatbot"
	"github.com/keybase/client/packaging/linux/tuxbot/bot/common"
	"github.com/keybase/go-keybase-chat-bot/kbchat"
	"github.com/keybase/go-keybase-chat-bot/kbchat/types/chat1"

	"github.com/pkg/errors"
	"github.com/subosito/gotenv"
)

const dockerNamespace = "keybaseio/client"

type Tuxbot struct {
	chatbot.Logger

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
		c.Info("`release/nightly/test revision?, [tux]journal, archive revision, build-docker revision?, release-docker tag`")
		c.Info("`cleanup, restartdocker`")
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
				"bash",
				"./packaging/linux/docker/build.sh",
				versionTag,
			)
			if err := buildCmd.Run(); err != nil {
				c.Info("failed to build error %s", err)
				if _, err := c.API().SendMessage(c.sendChannel, "!tuxjournal"); err != nil {
					c.Info("failed to tuxjournal error: %s", err)
				}
				return
			}

			c.Info("Completed building Docker tag %s. Pushing...", versionTag)

			// And the push!
			pushCmd := makeCmd(
				currentUser,
				"bash",
				"./packaging/linux/docker/push.sh",
				versionTag,
				"nightly",
			)
			pushCmd.Env = append(
				pushCmd.Env,
				"DOCKERHUB_USERNAME="+c.dockerUsername,
				"DOCKERHUB_PASSWORD="+c.dockerPassword,
			)
			pushCmd.Stdout = nil
			rd, err := pushCmd.StdoutPipe()
			if err != nil {
				c.Info("failed to prepare a stdout pipe: %v", err)
			}

			allOfStdout := make(chan []byte)
			defer close(allOfStdout)
			go func() {
				defer rd.Close()

				pushOutput := []byte{}
				pushBuffer := make([]byte, 255)
				for {
					n, err := rd.Read(pushBuffer)
					if err != nil {
						if err != io.EOF {
							c.Debug("docker push read error: %v", err)
						}
						break
					}
					os.Stdout.Write(pushBuffer[:n])
					pushOutput = append(pushOutput, pushBuffer[:n]...)
				}
				allOfStdout <- pushOutput
			}()

			if err := pushCmd.Start(); err != nil {
				c.Info("docker push start error: %v", err)
				return
			}

			err = pushCmd.Wait()
			stdout := <-allOfStdout
			if err != nil {
				c.Info("docker push wait error: %v\nstderr logged to journal, stdout:\n```\n%s```", err, string(stdout))
				return
			}
			c.Info("@%s %s", msg.Sender.Username, string(stdout))
		}()
		return nil
	case "release-docker":
		if len(args) == 0 {
			if _, err := c.API().SendMessage(c.sendChannel, "Usage: !release-docker [tag]"); err != nil {
				c.Debug("unable SendMessage: %v", err)
			}
			return nil
		}

		versionTag := strings.Replace(args[0], "+", "-", -1)

		c.Info("Pushing to Docker Hub %s as a new release...", versionTag)

		pushCmd := makeCmd(
			currentUser,
			"./packaging/linux/docker/push.sh",
			versionTag,
			"release",
		)
		pushCmd.Env = append(
			pushCmd.Env,
			"DOCKERHUB_USERNAME="+c.dockerUsername,
			"DOCKERHUB_PASSWORD="+c.dockerPassword,
		)
		pushCmd.Stdout = nil
		rd, err := pushCmd.StdoutPipe()
		if err != nil {
			c.Info("failed to prepare a stdout pipe: %v", err)
		}

		allOfStdout := make(chan []byte)
		defer close(allOfStdout)
		go func() {
			defer rd.Close()

			pushOutput := []byte{}
			pushBuffer := make([]byte, 255)
			for {
				n, err := rd.Read(pushBuffer)
				if err != nil {
					if err != io.EOF {
						c.Debug("docker push read error: %v", err)
					}
					break
				}
				os.Stdout.Write(pushBuffer[:n])
				pushOutput = append(pushOutput, pushBuffer[:n]...)
			}
			allOfStdout <- pushOutput
		}()

		if err := pushCmd.Start(); err != nil {
			return err
		}

		err = pushCmd.Wait()
		stdout := <-allOfStdout
		if err != nil {
			c.Info("docker push wait error: %v\nstderr logged to journal, stdout:\n```\n%s```", err, string(stdout))
			return err
		}
		c.Info("@%s %s", msg.Sender.Username, string(stdout))
		return nil
	case "tuxjournal", "journal":
		filename := fmt.Sprintf("/keybase/team/%s/%s-%s.txt", c.archiveTeam, command, time.Now().Format(time.RFC3339))
		var cmd *exec.Cmd
		if command == "tuxjournal" {
			cmd = exec.Command("journalctl", "--user-unit", "tuxbot", "-n", "1000")
		} else {
			cmd = exec.Command("journalctl", "-n", "100")
		}
		err = execToFile(filename, cmd)
		if err != nil {
			return err
		}
		c.Info("Wrote journal to %s", filename)
		return nil
	case "cleanup":
		cleanupCmd := exec.Command("./cleanup")
		cleanupCmd.Dir = filepath.Join(currentUser.HomeDir)
		ret, err := cleanupCmd.CombinedOutput()
		c.Debug("RET: ```%s```, ERR: %s", ret, err)
		return nil
	case "restartdocker":
		cmd := exec.Command("./restartdocker")
		cmd.Dir = filepath.Join(currentUser.HomeDir)
		ret, err := cmd.CombinedOutput()
		c.Debug("RET: ```%s```, ERR: %s", ret, err)
		return nil
	default:
		return fmt.Errorf("invalid command %s", command)
	}
}

func execToFile(filename string, cmd *exec.Cmd) error {
	handle, err := os.OpenFile(filename, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer handle.Close()
	var execErr bytes.Buffer
	cmd.Stdout = handle
	cmd.Stderr = &execErr
	err = cmd.Start()
	if err != nil {
		return err
	}
	err = cmd.Wait()
	if err != nil {
		return errors.Wrap(err, execErr.String())
	}
	return nil
}

func main() {
	err := gotenv.Load(fmt.Sprintf("/keybase/team/%s/.kbfs_autogit/%s/tuxbot.env", os.Getenv("SECRETS_TEAM"), os.Getenv("SECRETS_REPO")))
	if err != nil {
		panic(err)
	}

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

	if *infoTeam == "" || *infoChannel == "" {
		panic(fmt.Errorf("Chat team/channel specified: infoTeam=%q; infoChannel=%q", *infoTeam, *infoChannel))
	}

	debugC := chatbot.NewTeamChannel(*debugTeam, *debugChannel)
	infoC := chatbot.NewTeamChannel(*infoTeam, *infoChannel)
	logger := chatbot.ChatLogger{API: api, Name: *botName, DebugChannel: debugC, InfoChannel: infoC}

	tuxbot := Tuxbot{
		Logger: logger,

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
