// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// Adapted from github.com/reganm/ls

// +build !windows

package client

import (
	"bytes"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh/terminal"

	"github.com/keybase/client/go/protocol/keybase1"
)

// Base set of color codes for colorized output
const (
	color_fg_black   = 30
	color_fg_red     = 31
	color_fg_green   = 32
	color_fg_brown   = 33
	color_fg_blue    = 34
	color_fg_magenta = 35
	color_fg_cyan    = 36
	color_fg_white   = 37
	color_bg_black   = 40
	color_bg_red     = 41
	color_bg_green   = 42
	color_bg_brown   = 43
	color_bg_blue    = 44
	color_bg_magenta = 45
	color_bg_cyan    = 46
	color_bg_white   = 47
)

// This a FileInfo paired with the original path as passed in to the program.
// Unfortunately, the Name() in FileInfo is only the basename, so the associated
// path must be manually recorded as well.
type FileInfoPath struct {
	path string
	info os.FileInfo
}

// Implement os.FileInfo for a Dirent
type DirentFileInfo struct {
	Entry keybase1.Dirent
}

func (d DirentFileInfo) Name() string {
	// base name of the file
	return filepath.Base(d.Entry.Name)
}

func (d DirentFileInfo) Size() int64 {
	// length in bytes for regular files; system-dependent for others
	return int64(d.Entry.Size)
}

func (d DirentFileInfo) Mode() os.FileMode {
	// file mode bits
	switch d.Entry.DirentType {
	case keybase1.DirentType_FILE:
		return 0664
	case keybase1.DirentType_DIR:
		return os.ModeDir | 0664
	case keybase1.DirentType_SYM:
		return os.ModeSymlink | 0664
	case keybase1.DirentType_EXEC:
		return 0773
	}
	return 0
}

func (d DirentFileInfo) ModTime() time.Time {
	// modification time
	return time.Unix(int64(d.Entry.Time/1000), int64(d.Entry.Time%1000)*1000000)
}

func (d DirentFileInfo) IsDir() bool {
	// abbreviation for Mode().IsDir()
	if d.Entry.DirentType == keybase1.DirentType_DIR {
		return true
	}
	return false
}

func (d DirentFileInfo) Sys() interface{} {
	// underlying data source (can return nil)
	return nil
}

// Listings contain all the information about a file or directory in a printable
// form.
type Listing struct {
	permissions    string
	num_hard_links string
	owner          string
	group          string
	size           string
	epoch_nano     int64
	month          string
	day            string
	time           string
	name           string
	link_name      string
	link_orphan    bool
	is_socket      bool
	is_pipe        bool
	is_block       bool
	is_character   bool
}

// Global variables used by multiple functions
var (
	color_map map[string]string // matches file specification to output color
)

// Helper function for get_color_from_bsd_code.  Given a flag to indicate
// foreground/background and a single letter, return the correct partial ASCII
// color code.
func get_partial_color(foreground bool, letter uint8) string {
	var partial_bytes bytes.Buffer

	if foreground && letter == 'x' {
		partial_bytes.WriteString("0;")
	} else if !foreground && letter != 'x' {
		partial_bytes.WriteString(";")
	}

	if foreground && letter >= 97 && letter <= 122 {
		partial_bytes.WriteString("0;")
	} else if foreground && letter >= 65 && letter <= 90 {
		partial_bytes.WriteString("1;")
	}

	if letter == 'a' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_black))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_black))
		}
	} else if letter == 'b' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_red))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_red))
		}
	} else if letter == 'c' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_green))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_green))
		}
	} else if letter == 'd' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_brown))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_brown))
		}
	} else if letter == 'e' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_blue))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_blue))
		}
	} else if letter == 'f' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_magenta))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_magenta))
		}
	} else if letter == 'g' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_cyan))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_cyan))
		}
	} else if letter == 'h' {
		if foreground {
			partial_bytes.WriteString(strconv.Itoa(color_fg_white))
		} else if !foreground {
			partial_bytes.WriteString(strconv.Itoa(color_bg_white))
		}
	} else if letter == 'A' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_black))
	} else if letter == 'B' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_red))
	} else if letter == 'C' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_green))
	} else if letter == 'D' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_brown))
	} else if letter == 'E' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_blue))
	} else if letter == 'F' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_magenta))
	} else if letter == 'G' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_cyan))
	} else if letter == 'H' {
		partial_bytes.WriteString(strconv.Itoa(color_fg_white))
	}

	return partial_bytes.String()
}

// Given a BSD LSCOLORS code like "ex", return the proper ASCII code
// (like "\x1b[0;32m")
func get_color_from_bsd_code(code string) string {
	color_foreground := code[0]
	color_background := code[1]

	var color_bytes bytes.Buffer
	color_bytes.WriteString("\x1b[")
	color_bytes.WriteString(get_partial_color(true, color_foreground))
	color_bytes.WriteString(get_partial_color(false, color_background))
	color_bytes.WriteString("m")

	return color_bytes.String()
}

// Given an LSCOLORS string, fill in the appropriate keys and values of the
// global color_map.
func parse_LSCOLORS(LSCOLORS string) {
	for i := 0; i < len(LSCOLORS); i += 2 {
		if i == 0 {
			color_map["directory"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 2 {
			color_map["symlink"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 4 {
			color_map["socket"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 6 {
			color_map["pipe"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 8 {
			color_map["executable"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 10 {
			color_map["block"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 12 {
			color_map["character"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 14 {
			color_map["executable_suid"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 16 {
			color_map["executable_sgid"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 18 {
			color_map["directory_o+w_sticky"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		} else if i == 20 {
			color_map["directory_o+w"] =
				get_color_from_bsd_code(LSCOLORS[i : i+2])
		}
	}
}

// Write the given Listing's name to the output buffer, with the appropriate
// formatting based on the current options.
func (c *CmdSimpleFSList) write_listing_name(output_buffer *bytes.Buffer, l Listing) {

	if c.options.color {
		applied_color := false

		num_hardlinks, _ := strconv.Atoi(l.num_hard_links)

		// "file.name.txt" -> "*.txt"
		name_split := strings.Split(l.name, ".")
		extension_str := ""
		if len(name_split) > 1 {
			extension_str = fmt.Sprintf("*.%s", name_split[len(name_split)-1])
		}

		if extension_str != "" && color_map[extension_str] != "" {
			output_buffer.WriteString(color_map[extension_str])
			applied_color = true
		} else if l.permissions[0] == 'd' &&
			l.permissions[8] == 'w' && l.permissions[9] == 't' {
			output_buffer.WriteString(color_map["directory_o+w_sticky"])
			applied_color = true
		} else if l.permissions[0] == 'd' && l.permissions[9] == 't' {
			output_buffer.WriteString(color_map["directory_sticky"])
			applied_color = true
		} else if l.permissions[0] == 'd' && l.permissions[8] == 'w' {
			output_buffer.WriteString(color_map["directory_o+w"])
			applied_color = true
		} else if l.permissions[0] == 'd' { // directory
			output_buffer.WriteString(color_map["directory"])
			applied_color = true
		} else if num_hardlinks > 1 { // multiple hardlinks
			output_buffer.WriteString(color_map["multi_hardlink"])
			applied_color = true
		} else if l.permissions[0] == 'l' && l.link_orphan { // orphan link
			output_buffer.WriteString(color_map["link_orphan"])
			applied_color = true
		} else if l.permissions[0] == 'l' { // symlink
			output_buffer.WriteString(color_map["symlink"])
			applied_color = true
		} else if l.permissions[3] == 's' { // setuid
			output_buffer.WriteString(color_map["executable_suid"])
			applied_color = true
		} else if l.permissions[6] == 's' { // setgid
			output_buffer.WriteString(color_map["executable_sgid"])
			applied_color = true
		} else if strings.Contains(l.permissions, "x") { // executable
			output_buffer.WriteString(color_map["executable"])
			applied_color = true
		} else if l.is_socket { // socket
			output_buffer.WriteString(color_map["socket"])
			applied_color = true
		} else if l.is_pipe { // pipe
			output_buffer.WriteString(color_map["pipe"])
			applied_color = true
		} else if l.is_block { // block
			output_buffer.WriteString(color_map["block"])
			applied_color = true
		} else if l.is_character { // character
			output_buffer.WriteString(color_map["character"])
			applied_color = true
		}

		output_buffer.WriteString(l.name)
		if applied_color {
			output_buffer.WriteString(color_map["end"])
		}
	} else {
		output_buffer.WriteString(l.name)
	}

	if l.permissions[0] == 'l' && c.options.long {
		if l.link_orphan {
			output_buffer.WriteString(fmt.Sprintf(" -> %s%s%s",
				color_map["link_orphan_target"],
				l.link_name,
				color_map["end"]))
		} else {
			output_buffer.WriteString(fmt.Sprintf(" -> %s", l.link_name))
		}
	}
}

// Convert a FileInfoPath object to a Listing.  The dirname is passed for
// following symlinks.
func (c *CmdSimpleFSList) create_listing(dirname string, fip FileInfoPath) (Listing, error) {
	var current_listing Listing

	// permissions string
	current_listing.permissions = fip.info.Mode().String()
	if fip.info.Mode()&os.ModeSymlink == os.ModeSymlink {
		current_listing.permissions = strings.Replace(
			current_listing.permissions, "L", "l", 1)

		var _pathstr string
		if dirname == "" {
			_pathstr = fmt.Sprintf("%s", fip.path)
		} else {
			_pathstr = fmt.Sprintf("%s/%s", dirname, fip.path)
		}
		link, err := os.Readlink(fmt.Sprintf(_pathstr))
		if err != nil {
			return current_listing, err
		}
		current_listing.link_name = link

		// check to see if the symlink target exists
		var _link_pathstr string
		if dirname == "" {
			_link_pathstr = fmt.Sprintf("%s", link)
		} else {
			_link_pathstr = fmt.Sprintf("%s/%s", dirname, link)
		}
		_, err = os.Open(_link_pathstr)
		if err != nil {
			if os.IsNotExist(err) {
				current_listing.link_orphan = true
			} else {
				return current_listing, err
			}
		}
	} else if current_listing.permissions[0] == 'D' {
		current_listing.permissions = current_listing.permissions[1:]
	} else if current_listing.permissions[0:2] == "ug" {
		current_listing.permissions =
			strings.Replace(current_listing.permissions, "ug", "-", 1)
		current_listing.permissions = fmt.Sprintf("%ss%ss%s",
			current_listing.permissions[0:3],
			current_listing.permissions[4:6],
			current_listing.permissions[7:])
	} else if current_listing.permissions[0] == 'u' {
		current_listing.permissions =
			strings.Replace(current_listing.permissions, "u", "-", 1)
		current_listing.permissions = fmt.Sprintf("%ss%s",
			current_listing.permissions[0:3],
			current_listing.permissions[4:])
	} else if current_listing.permissions[0] == 'g' {
		current_listing.permissions =
			strings.Replace(current_listing.permissions, "g", "-", 1)
		current_listing.permissions = fmt.Sprintf("%ss%s",
			current_listing.permissions[0:6],
			current_listing.permissions[7:])
	} else if current_listing.permissions[0:2] == "dt" {
		current_listing.permissions =
			strings.Replace(current_listing.permissions, "dt", "d", 1)
		current_listing.permissions = fmt.Sprintf("%st",
			current_listing.permissions[0:len(current_listing.permissions)-1])
	}

	// size
	if c.options.human {
		size := float64(fip.info.Size())

		count := 0
		for size >= 1.0 {
			size /= 1024
			count++
		}

		if count < 0 {
			count = 0
		} else if count > 0 {
			size *= 1024
			count--
		}

		var suffix string
		if count == 0 {
			suffix = "B"
		} else if count == 1 {
			suffix = "K"
		} else if count == 2 {
			suffix = "M"
		} else if count == 3 {
			suffix = "G"
		} else if count == 4 {
			suffix = "T"
		} else if count == 5 {
			suffix = "P"
		} else if count == 6 {
			suffix = "E"
		} else {
			suffix = "?"
		}

		size_str := ""
		if count == 0 {
			size_b := int64(size)
			size_str = fmt.Sprintf("%d%s", size_b, suffix)
		} else {
			// looks like the printf formatting automatically rounds up
			size_str = fmt.Sprintf("%.1f%s", size, suffix)
		}

		// drop the trailing .0 if it exists in the size
		// e.g. 14.0K -> 14K
		if len(size_str) > 3 &&
			size_str[len(size_str)-3:len(size_str)-1] == ".0" {
			size_str = size_str[0:len(size_str)-3] + suffix
		}

		current_listing.size = size_str

	} else {
		current_listing.size = fmt.Sprintf("%d", fip.info.Size())
	}

	// epoch_nano
	current_listing.epoch_nano = fip.info.ModTime().UnixNano()

	// month
	current_listing.month = fip.info.ModTime().Month().String()[0:3]

	// day
	current_listing.day = fmt.Sprintf("%02d", fip.info.ModTime().Day())

	// time
	// if older than six months, print the year
	// otherwise, print hour:minute
	epoch_now := time.Now().Unix()
	var seconds_in_six_months int64 = 182 * 24 * 60 * 60
	epoch_six_months_ago := epoch_now - seconds_in_six_months
	epoch_modified := fip.info.ModTime().Unix()

	var time_str string
	if epoch_modified <= epoch_six_months_ago ||
		epoch_modified >= (epoch_now+5) {
		time_str = fmt.Sprintf("%d", fip.info.ModTime().Year())
	} else {
		time_str = fmt.Sprintf("%02d:%02d",
			fip.info.ModTime().Hour(),
			fip.info.ModTime().Minute())
	}

	current_listing.time = time_str

	current_listing.name = fip.path

	// character?
	if fip.info.Mode()&os.ModeCharDevice == os.ModeCharDevice {
		current_listing.is_character = true
	} else if fip.info.Mode()&os.ModeDevice == os.ModeDevice { // block?
		current_listing.is_block = true
	} else if fip.info.Mode()&os.ModeNamedPipe == os.ModeNamedPipe { // pipe?
		current_listing.is_pipe = true
	} else if fip.info.Mode()&os.ModeSocket == os.ModeSocket { // socket?
		current_listing.is_socket = true
	}

	return current_listing, nil
}

// Comparison function used for sorting Listings by name.
func compare_name(a, b Listing) int {
	a_name_lower := strings.ToLower(a.name)
	b_name_lower := strings.ToLower(b.name)

	var smaller_len int
	if len(a.name) < len(b.name) {
		smaller_len = len(a.name)
	} else {
		smaller_len = len(b.name)
	}

	for i := 0; i < smaller_len; i++ {
		if a_name_lower[i] < b_name_lower[i] {
			return -1
		} else if a_name_lower[i] > b_name_lower[i] {
			return 1
		}
	}

	if len(a.name) < len(b.name) {
		return -1
	} else if len(b.name) < len(a.name) {
		return 1
	} else {
		return 0
	}
}

// Comparison function used for sorting Listings by modification time, from most
// recent to oldest.
func compare_time(a, b Listing) int {
	if a.epoch_nano >= b.epoch_nano {
		return -1
	}

	return 1
}

// Comparison function used for sorting Listings by size, from largest to
// smallest.
func compare_size(a, b Listing) int {
	a_size, _ := strconv.Atoi(a.size)
	b_size, _ := strconv.Atoi(b.size)

	if a_size >= b_size {
		return -1
	}

	return 1
}

// Sort the given listings, taking into account the current program options.
func (c *CmdSimpleFSList) sort_listings(listings []Listing) {
	comparison_function := compare_name
	if c.options.sort_time {
		comparison_function = compare_time
	} else if c.options.sort_size {
		comparison_function = compare_size
	}

	for {
		done := true
		for i := 0; i < len(listings)-1; i++ {
			a := listings[i]
			b := listings[i+1]

			if comparison_function(a, b) > -1 {
				tmp := a
				listings[i] = listings[i+1]
				listings[i+1] = tmp
				done = false
			}
		}
		if done {
			break
		}
	}

	if c.options.sort_reverse {
		middle_index := (len(listings) / 2)
		if len(listings)%2 == 0 {
			middle_index--
		}

		for i := 0; i <= middle_index; i++ {
			front_index := i
			rear_index := len(listings) - 1 - i

			if front_index == rear_index {
				break
			}

			tmp := listings[front_index]
			listings[front_index] = listings[rear_index]
			listings[rear_index] = tmp
		}
	}
}

// Given a set of Listings, print them to the output buffer, taking into account
// the current program arguments and terminal width as necessary.
func (c *CmdSimpleFSList) write_listings_to_buffer(output_buffer *bytes.Buffer,
	listings []Listing,
	terminal_width int) {

	if len(listings) == 0 {
		return
	}

	if c.options.long {
		var (
			width_permissions    int = 0
			width_num_hard_links int = 0
			width_owner          int = 0
			width_group          int = 0
			width_size           int = 0
			width_time           int = 0
		)
		// check max widths for each field
		for _, l := range listings {
			if len(l.permissions) > width_permissions {
				width_permissions = len(l.permissions)
			}
			if len(l.num_hard_links) > width_num_hard_links {
				width_num_hard_links = len(l.num_hard_links)
			}
			if len(l.owner) > width_owner {
				width_owner = len(l.owner)
			}
			if len(l.group) > width_group {
				width_group = len(l.group)
			}
			if len(l.size) > width_size {
				width_size = len(l.size)
			}
			if len(l.time) > width_time {
				width_time = len(l.time)
			}
		}

		// now print the listings
		for _, l := range listings {
			// permissions
			output_buffer.WriteString(l.permissions)
			for i := 0; i < width_permissions-len(l.permissions); i++ {
				output_buffer.WriteString(" ")
			}
			output_buffer.WriteString(" ")

			// number of hard links (right justified)
			for i := 0; i < width_num_hard_links-len(l.num_hard_links); i++ {
				output_buffer.WriteString(" ")
			}
			for i := 0; i < 2-width_num_hard_links; i++ {
				output_buffer.WriteString(" ")
			}
			output_buffer.WriteString(l.num_hard_links)
			output_buffer.WriteString(" ")

			// owner
			output_buffer.WriteString(l.owner)
			for i := 0; i < width_owner-len(l.owner); i++ {
				output_buffer.WriteString(" ")
			}
			output_buffer.WriteString(" ")

			// group
			output_buffer.WriteString(l.group)
			for i := 0; i < width_group-len(l.group); i++ {
				output_buffer.WriteString(" ")
			}
			output_buffer.WriteString(" ")

			// size
			for i := 0; i < width_size-len(l.size); i++ {
				output_buffer.WriteString(" ")
			}
			output_buffer.WriteString(l.size)
			output_buffer.WriteString(" ")

			// month
			output_buffer.WriteString(l.month)
			output_buffer.WriteString(" ")

			// day
			output_buffer.WriteString(l.day)
			output_buffer.WriteString(" ")

			// time
			for i := 0; i < width_time-len(l.time); i++ {
				output_buffer.WriteString(" ")
			}
			output_buffer.WriteString(l.time)
			output_buffer.WriteString(" ")

			// name
			c.write_listing_name(output_buffer, l)
			output_buffer.WriteString("\n")
		}
	} else if c.options.one {
		separator := "\n"

		for _, l := range listings {
			c.write_listing_name(output_buffer, l)
			output_buffer.WriteString(separator)
		}
	} else {
		separator := "  "

		// calculate the number of rows needed for column output
		num_rows := 1
		var col_widths []int
		for {
			num_cols_float := float64(len(listings)) / float64(num_rows)
			num_cols_float = math.Ceil(num_cols_float)
			num_cols := int(num_cols_float)

			col_widths = make([]int, num_cols)
			for i, _ := range col_widths {
				col_widths[i] = 0
			}

			col_listings := make([]int, num_cols)
			for i := 0; i < len(col_listings); i++ {
				col_listings[i] = 0
			}

			// calculate necessary column widths
			// also calculate the number of listings per column
			for i := 0; i < len(listings); i++ {
				col := i / num_rows
				if col_widths[col] < len(listings[i].name) {
					col_widths[col] = len(listings[i].name)
				}
				col_listings[col]++
			}

			// calculate the maximum width of each row
			max_row_length := 0
			for i := 0; i < num_cols; i++ {
				max_row_length += col_widths[i]
			}
			max_row_length += len(separator) * (num_cols - 1)

			if max_row_length > terminal_width && num_rows >= len(listings) {
				break
			} else if max_row_length > terminal_width {
				num_rows++
			} else {
				listings_in_first_col := col_listings[0]
				listings_in_last_col := col_listings[len(col_listings)-1]

				// prevent short last (right-hand) columns
				if listings_in_last_col <= listings_in_first_col/2 &&
					listings_in_first_col-listings_in_last_col >= 5 {
					num_rows++
				} else {
					break
				}
			}
		}

		for r := 0; r < num_rows; r++ {
			for i, l := range listings {
				if i%num_rows == r {
					c.write_listing_name(output_buffer, l)
					for s := 0; s < col_widths[i/num_rows]-len(l.name); s++ {
						output_buffer.WriteString(" ")
					}
					output_buffer.WriteString(separator)
				}
			}
			if len(listings) > 0 {
				output_buffer.Truncate(output_buffer.Len() - len(separator))
			}
			output_buffer.WriteString("\n")
		}
	}
}

// Parse the program arguments and write the appropriate listings to the output
// buffer.
func (c *CmdSimpleFSList) ls(output_buffer *bytes.Buffer, listResult keybase1.SimpleFSListResult, width int) error {
	list_dirs := make([]Listing, 0)
	list_files := make([]Listing, 0)

	//
	// determine color output
	//

	if c.options.color {
		color_map = make(map[string]string)
		color_map["end"] = "\x1b[0m"

		LS_COLORS := os.Getenv("LS_COLORS")
		LSCOLORS := os.Getenv("LSCOLORS")

		if LSCOLORS != "" {
			parse_LSCOLORS(LSCOLORS)
		} else if LS_COLORS != "" {
			// parse LS_COLORS
			LS_COLORS_split := strings.Split(LS_COLORS, ":")
			for _, i := range LS_COLORS_split {
				if i == "" {
					continue
				}

				i_split := strings.Split(i, "=")
				color_code := fmt.Sprintf("\x1b[%sm", i_split[1])

				if i_split[0] == "rs" {
					color_map["end"] = color_code
				} else if i_split[0] == "di" {
					color_map["directory"] = color_code
				} else if i_split[0] == "ln" {
					color_map["symlink"] = color_code
				} else if i_split[0] == "mh" {
					color_map["multi_hardlink"] = color_code
				} else if i_split[0] == "pi" {
					color_map["pipe"] = color_code
				} else if i_split[0] == "so" {
					color_map["socket"] = color_code
				} else if i_split[0] == "bd" {
					color_map["block"] = color_code
				} else if i_split[0] == "cd" {
					color_map["character"] = color_code
				} else if i_split[0] == "or" {
					color_map["link_orphan"] = color_code
				} else if i_split[0] == "mi" {
					color_map["link_orphan_target"] = color_code
				} else if i_split[0] == "su" {
					color_map["executable_suid"] = color_code
				} else if i_split[0] == "sg" {
					color_map["executable_sgid"] = color_code
				} else if i_split[0] == "tw" {
					color_map["directory_o+w_sticky"] = color_code
				} else if i_split[0] == "ow" {
					color_map["directory_o+w"] = color_code
				} else if i_split[0] == "st" {
					color_map["directory_sticky"] = color_code
				} else if i_split[0] == "ex" {
					color_map["executable"] = color_code
				} else {
					color_map[i_split[0]] = color_code
				}

				// ca - CAPABILITY? -- not supported!
				// do - DOOR -- not supported!
			}
		} else {
			// use the default LSCOLORS
			parse_LSCOLORS("exfxcxdxbxegedabagacad")
		}
	}

	for _, e := range listResult.Entries {

		//
		// separate the files from the directories
		//
		//	for _, f := range args_files {
		//info, err := os.Stat(f)

		f_listing, err := c.create_listing("",
			FileInfoPath{path: e.Name,
				info: DirentFileInfo{e}})
		if err != nil {
			return err
		}

		// for option_dir (-d), treat directories like regular files
		if c.options.dir {
			list_files = append(list_files, f_listing)
		} else { // else, separate the files and directories
			if e.DirentType == keybase1.DirentType_DIR {
				list_dirs = append(list_dirs, f_listing)
			} else {
				list_files = append(list_files, f_listing)
			}
		}
	}

	num_files := len(list_files)
	num_dirs := len(list_dirs)

	// sort the lists if necessary
	c.sort_listings(list_files)
	c.sort_listings(list_dirs)

	//
	// list the files first (unless --dirs-first)
	//
	if num_files > 0 && !c.options.dirs_first {
		c.write_listings_to_buffer(output_buffer,
			list_files,
			width)
	}

	//
	// then list the directories
	//
	if num_dirs > 0 {
		c.write_listings_to_buffer(output_buffer,
			list_dirs,
			width)
	}
	//
	// list the files now if --dirs-first
	//
	if num_files > 0 && c.options.dirs_first {
		c.write_listings_to_buffer(output_buffer,
			list_files,
			width)
	}

	return nil
}

func (c *CmdSimpleFSList) output(listResult keybase1.SimpleFSListResult) error {

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("\n")

	// capture the current terminal dimensions
	terminal_width, _, err := terminal.GetSize(int(os.Stdout.Fd()))
	if err != nil {
		return err
	}

	var output_buffer bytes.Buffer

	err = c.ls(&output_buffer, listResult, terminal_width)
	if err != nil {
		return err
	}

	if output_buffer.String() != "" {
		ui.Printf("%s\n", output_buffer.String())
	}
	return nil
}
