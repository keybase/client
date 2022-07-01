package chatbot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/google/shlex"

	"github.com/keybase/client/packaging/linux/tuxbot/bot/access"
	"github.com/keybase/go-keybase-chat-bot/kbchat"
	"github.com/keybase/go-keybase-chat-bot/kbchat/types/chat1"
)

type Bot interface {
	Logger
	API() *kbchat.API
	Dispatch(msg chat1.MsgSummary, args []string) error
	DispatchReaction(msg chat1.MsgSummary, message string) error
	SourceDirectory() string
	ACL() access.ACL
	WarnOnCrash() bool
}

func Ingest(bot Bot, msg chat1.MsgSummary) error {
	if msg.Content.TypeName == "reaction" {
		return bot.DispatchReaction(msg, msg.Content.Reaction.Body)
	}

	if msg.Content.TypeName != "text" {
		return nil
	}

	args, err := shlex.Split(msg.Content.Text.Body)
	if err != nil {
		return nil
	}

	for idx, arg := range args {
		if strings.HasPrefix(arg, "#") {
			args = args[:idx]
			break
		}
	}

	return bot.Dispatch(msg, args)
}

func Listen(bot Bot) error {
	if bot == nil {
		return fmt.Errorf("nil bot")
	}

	bot.Debug("Listening...")
	subscription, err := bot.API().ListenForNewTextMessages()
	if err != nil {
		return err
	}
	acl := bot.ACL()
	for {
		msg, err := subscription.Read()
		switch err := err.(type) {
		case nil:
		case *json.SyntaxError:
			// It is likely that the Keybase service crashed resulting in a
			// broken api-listen pipe, so exit - hopefully, the process
			// manager will restart us and the keybase service.
			if bot.WarnOnCrash() {
				bot.Info("Error reading message (fatal): %v", err)
			}
			os.Exit(1)
		default:
			bot.Info("Error reading message (nonfatal): %v", err)
			continue
		}

		ok, err := acl.Allowed(msg.Message.Channel, access.Username(msg.Message.Sender.Username))
		if err != nil || !ok {
			continue
		}

		err = Ingest(bot, msg.Message)
		if err != nil {
			continue
		}
	}
}

func MakeAPI(keybaseBinaryPath string) (*kbchat.API, error) {
	runOptions := kbchat.RunOptions{KeybaseLocation: keybaseBinaryPath}
	return kbchat.Start(runOptions)
}

type ChatLogger struct {
	API          *kbchat.API
	Name         string
	DebugChannel chat1.ChatChannel
	InfoChannel  chat1.ChatChannel
}

var _ Logger = (*ChatLogger)(nil)

func (l ChatLogger) msg(format string, args ...interface{}) string {
	m := fmt.Sprintf(format, args...)
	if l.Name == "" {
		return m
	}
	return fmt.Sprintf("`(%s)` %s", l.Name, m)
}

func (l ChatLogger) VDebug(format string, args ...interface{}) {
	msg := l.msg(format, args...)
	fmt.Println(msg)
}

func (l ChatLogger) Debug(format string, args ...interface{}) {
	msg := l.msg(format, args...)
	fmt.Println(msg)
	if _, err := l.API.SendMessage(l.DebugChannel, msg); err != nil {
		fmt.Printf("unable to SendMessage: %v", err)
	}
}

func (l ChatLogger) Info(format string, args ...interface{}) {
	if _, err := l.API.SendMessage(l.InfoChannel, l.msg(format, args...)); err != nil {
		fmt.Printf("unable to SendMessage: %v", err)
	}
	if l.InfoChannel.Name != l.DebugChannel.Name || l.InfoChannel.TopicName != l.DebugChannel.TopicName {
		l.Debug(format, args...)
	}
}

func (l ChatLogger) Alert() {
	l.Info("@here")
}

func (l ChatLogger) AlertWith(s string) {
	l.Info("@here %s", s)
}

func NewTeamChannel(name, channel string) chat1.ChatChannel {
	return chat1.ChatChannel{Name: name, TopicName: channel, MembersType: "team", TopicType: "chat", Public: false}
}

func Exec(bot Bot, dir string, timeout time.Duration, name string, arg ...string) (stdoutStr string, stderrStr string, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, arg...)

	// Hide informational log messages to avoid cluttering stdout for the manage.iced script
	cmd.Env = append(cmd.Env, "LOG_LEVEL_manage=fatal")

	// rpcsrv connection hangs without RUN_MODE
	cmd.Env = append(cmd.Env, fmt.Sprintf("RUN_MODE=%s", os.Getenv("RUN_MODE")))

	// Forward ssh agent
	cmd.Env = append(cmd.Env, fmt.Sprintf("SSH_AUTH_SOCK=%s", os.Getenv("SSH_AUTH_SOCK")))

	// Forward path for node
	cmd.Env = append(cmd.Env, fmt.Sprintf("PATH=%s", os.Getenv("PATH")))

	// Forward home for keybase env
	cmd.Env = append(cmd.Env, fmt.Sprintf("HOME=%s", os.Getenv("HOME")))

	// Fail immediately on git username/password request
	cmd.Env = append(cmd.Env, fmt.Sprintf("GIT_TERMINAL_PROMPT=0"))

	cmd.Dir = dir

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()

	stderrStr = stderr.String()
	if err != nil {
		err = fmt.Errorf("%s %v: %s: %s", name, arg, err.Error(), stderrStr)
	}

	return stdout.String(), stderrStr, err
}

const defaultTimeout = 15 * time.Second

func ExecShowResults(bot Bot, dir string, name string, arg ...string) (stdout string, stderr string, err error) {
	return ExecShowResultsOpts(bot, dir, defaultTimeout, name, arg...)
}

func ExecShowResultsOpts(bot Bot, dir string, timeout time.Duration, name string, arg ...string) (stdout string, stderr string, err error) {
	bot.Debug("```$ %s %s```", name, strings.Join(arg, " "))
	stdout, stderr, err = Exec(bot, dir, timeout, name, arg...)
	if len(stdout) > 0 {
		bot.Debug("```%s```", stdout)
	}
	if len(stderr) > 0 {
		bot.Debug("```%s```", stderr)
	}
	if err != nil {
		bot.Debug("ERROR: %s", err.Error())
		return "", "", err
	}

	return stdout, stderr, err
}

func ExecShow(bot Bot, dir string, name string, arg ...string) (err error) {
	return ExecShowOpts(bot, dir, defaultTimeout, name, arg...)
}

func ExecShowOpts(bot Bot, dir string, timeout time.Duration, name string, arg ...string) (err error) {
	_, _, err = ExecShowResultsOpts(bot, dir, timeout, name, arg...)
	return err
}

func GitPullAt(bot Bot, dir string, commit string) (err error) {
	err = ExecShow(bot, dir, "git", "diff", "--quiet")
	if err != nil {
		return fmt.Errorf("working directory not clean: %s", err)
	}
	err = ExecShow(bot, dir, "git", "fetch")
	if err != nil {
		return err
	}
	err = ExecShow(bot, dir, "git", "checkout", commit)
	if err != nil {
		return err
	}
	return nil
}

func GitPull(bot Bot, dir string, remote string, branch string) (err error) {
	return ExecShow(bot, dir, "git", "pull", "--ff-only", remote, branch)
}

func UpdateBot(bot Bot) (err error) {
	err = ExecShow(bot, bot.SourceDirectory(), "git", "pull", "--ff-only")
	if err != nil {
		return err
	}
	err = ExecShow(bot, bot.SourceDirectory(), "bin/keybase", "ctl", "stop")
	if err != nil {
		return err
	}
	bot.Debug("Terminating...")
	os.Exit(0)
	return nil
}
