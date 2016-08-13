package client

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	keybase1 "github.com/keybase/client/go/protocol"
)

type cliChatMessage struct {
	isNew         bool
	with          []string // private msg if len == 2
	topic         string
	author        string
	timestamp     time.Time
	formattedBody string
}

func (m *cliChatMessage) formatWith() (formatted string) {
	if len(m.with) > 2 {
		formatted = "with " + strings.Join(m.with, ",")
	}
	return formatted
}

func (m *cliChatMessage) formatTopic() (formatted string) {
	if len(m.topic) > 0 {
		return "#" + m.topic
	}
	return formatted
}

func (m *cliChatMessage) formatTimestamp() (formatted string) {
	d := time.Since(m.timestamp)
	return (time.Duration(math.Floor(d.Minutes())) * time.Minute).String()
}

func (m *cliChatMessage) formatFields() (fields []string) {
	newMarker := "-"
	if m.isNew {
		newMarker = "+"
	}

	with := m.formatWith()
	topic := m.formatTopic()
	author := fmt.Sprintf("[%s %s]:", m.author, m.formatTimestamp())

	return []string{newMarker, with, topic, author, m.formattedBody}
}

func (m *cliChatMessage) formatSpace() string {
	var fields []string
	for _, f := range m.formatFields() {
		if len(f) > 0 {
			fields = append(fields, f)
		}
	}
	return strings.Join(fields, " ")
}

func formatChatText(body *keybase1.MessageText) string {
	return body.Body
}

func formatChatAttachment(body *keybase1.MessageAttachment) string {
	return fmt.Sprintf("{Attachment}\n    Caption: <unimplemented>\n    KBFS:    %s", body.Path)
}

type cliChatMessages []cliChatMessage

type byUnreadThenLatest cliChatMessages

func (a byUnreadThenLatest) Len() int      { return len(a) }
func (a byUnreadThenLatest) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a byUnreadThenLatest) Less(i, j int) bool {
	if a[i].isNew != a[j].isNew {
		return a[i].isNew
	}
	return a[i].timestamp.After(a[j].timestamp)
}

func (c cliChatMessages) printUnreadByLatest() {
	if len(c) == 0 {
		return
	}
	sort.Sort(byUnreadThenLatest(c))

	unreadCount := 0
	for ; unreadCount < len(c) && c[unreadCount].isNew; unreadCount++ {
	}

	if unreadCount == 0 {
		fmt.Println("0 new messages.")
	} else {
		fmt.Printf("%d new messages:\n", unreadCount)
		for _, m := range c[:unreadCount] {
			fmt.Printf("  %s\n", m.formatSpace())
		}
	}
}

func (c cliChatMessages) printByUnreadThenLatest() {
	if len(c) == 0 {
		return
	}
	sort.Sort(byUnreadThenLatest(c))

	unreadCount := 0
	for ; unreadCount < len(c) && c[unreadCount].isNew; unreadCount++ {
	}

	if unreadCount == 0 {
		fmt.Println("0 new messages.")
	} else {
		fmt.Printf("%d new messages:\n", unreadCount)
		for _, m := range c[:unreadCount] {
			fmt.Printf("  %s\n", m.formatSpace())
		}
	}

	if unreadCount == len(c) {
		fmt.Println("0 old messages.")
	} else {
		fmt.Printf("%d old messages:\n", len(c)-unreadCount)
		for _, m := range c[unreadCount:] {
			fmt.Printf("  %s\n", m.formatSpace())
		}
	}
}
