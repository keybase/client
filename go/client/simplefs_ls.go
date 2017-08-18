// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// Adapted from github.com/reganm/ls

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

	"github.com/keybase/client/go/protocol/keybase1"
)

// Base set of color codes for colorized output
const (
	colorFgBlack   = 30
	colorFgRed     = 31
	colorFgGreen   = 32
	colorFgBrown   = 33
	colorFgBlue    = 34
	colorFgMagenta = 35
	colorFgCyan    = 36
	colorFgWhite   = 37
	colorBgBlack   = 40
	colorBgRed     = 41
	colorBgGreen   = 42
	colorBgBrown   = 43
	colorBgBlue    = 44
	colorBgMagenta = 45
	colorBgCyan    = 46
	colorBgWhite   = 47
)

// FileInfoPath is a FileInfo paired with the original path as passed in to the program.
// Unfortunately, the Name() in FileInfo is only the basename, so the associated
// path must be manually recorded as well.
type FileInfoPath struct {
	path string
	info os.FileInfo
}

// DirentFileInfo implements os.FileInfo for a Dirent
type DirentFileInfo struct {
	Entry keybase1.Dirent
}

// Name returns the base name of the file
func (d DirentFileInfo) Name() string {
	return filepath.Base(d.Entry.Name)
}

// Size - length in bytes for regular files; system-dependent for others
func (d DirentFileInfo) Size() int64 {
	return int64(d.Entry.Size)
}

// Mode returns the file mode bits
func (d DirentFileInfo) Mode() os.FileMode {
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

// ModTime returns modification time
func (d DirentFileInfo) ModTime() time.Time {
	return time.Unix(int64(d.Entry.Time/1000), int64(d.Entry.Time%1000)*1000000)
}

// IsDir is an abbreviation for Mode().IsDir()
func (d DirentFileInfo) IsDir() bool {
	if d.Entry.DirentType == keybase1.DirentType_DIR {
		return true
	}
	return false
}

// Sys - underlying data source (can return nil)
func (d DirentFileInfo) Sys() interface{} {
	return nil
}

// Listing contains all the information about a file or directory in a printable
// form.
type Listing struct {
	permissions  string
	numHardLinks string
	owner        string
	group        string
	size         string
	epochNano    int64
	month        string
	day          string
	time         string
	name         string
	linkName     string
	linkOrphan   bool
	isSocket     bool
	isPipe       bool
	isBlock      bool
	isCharacter  bool
}

// Global variables used by multiple functions
var (
	colorMap map[string]string // matches file specification to output color
)

// Helper function for getColorFromBsdCode.  Given a flag to indicate
// foreground/background and a single letter, return the correct partial ASCII
// color code.
func getPartialColor(foreground bool, letter uint8) string {
	var partialBytes bytes.Buffer

	if foreground && letter == 'x' {
		partialBytes.WriteString("0;")
	} else if !foreground && letter != 'x' {
		partialBytes.WriteString(";")
	}

	if foreground && letter >= 97 && letter <= 122 {
		partialBytes.WriteString("0;")
	} else if foreground && letter >= 65 && letter <= 90 {
		partialBytes.WriteString("1;")
	}

	if letter == 'a' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgBlack))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgBlack))
		}
	} else if letter == 'b' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgRed))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgRed))
		}
	} else if letter == 'c' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgGreen))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgGreen))
		}
	} else if letter == 'd' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgBrown))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgBrown))
		}
	} else if letter == 'e' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgBlue))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgBlue))
		}
	} else if letter == 'f' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgMagenta))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgMagenta))
		}
	} else if letter == 'g' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgCyan))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgCyan))
		}
	} else if letter == 'h' {
		if foreground {
			partialBytes.WriteString(strconv.Itoa(colorFgWhite))
		} else if !foreground {
			partialBytes.WriteString(strconv.Itoa(colorBgWhite))
		}
	} else if letter == 'A' {
		partialBytes.WriteString(strconv.Itoa(colorFgBlack))
	} else if letter == 'B' {
		partialBytes.WriteString(strconv.Itoa(colorFgRed))
	} else if letter == 'C' {
		partialBytes.WriteString(strconv.Itoa(colorFgGreen))
	} else if letter == 'D' {
		partialBytes.WriteString(strconv.Itoa(colorFgBrown))
	} else if letter == 'E' {
		partialBytes.WriteString(strconv.Itoa(colorFgBlue))
	} else if letter == 'F' {
		partialBytes.WriteString(strconv.Itoa(colorFgMagenta))
	} else if letter == 'G' {
		partialBytes.WriteString(strconv.Itoa(colorFgCyan))
	} else if letter == 'H' {
		partialBytes.WriteString(strconv.Itoa(colorFgWhite))
	}

	return partialBytes.String()
}

// Given a BSD LSCOLORS code like "ex", return the proper ASCII code
// (like "\x1b[0;32m")
func getColorFromBsdCode(code string) string {
	colorForeground := code[0]
	colorBackground := code[1]

	var colorBytes bytes.Buffer
	colorBytes.WriteString("\x1b[")
	colorBytes.WriteString(getPartialColor(true, colorForeground))
	colorBytes.WriteString(getPartialColor(false, colorBackground))
	colorBytes.WriteString("m")

	return colorBytes.String()
}

// Given an LSCOLORS string, fill in the appropriate keys and values of the
// global colorMap.
func parseLsColors(lsColors string) {
	for i := 0; i < len(lsColors); i += 2 {
		if i == 0 {
			colorMap["directory"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 2 {
			colorMap["symlink"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 4 {
			colorMap["socket"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 6 {
			colorMap["pipe"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 8 {
			colorMap["executable"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 10 {
			colorMap["block"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 12 {
			colorMap["character"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 14 {
			colorMap["executable_suid"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 16 {
			colorMap["executable_sgid"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 18 {
			colorMap["directory_o+w_sticky"] =
				getColorFromBsdCode(lsColors[i : i+2])
		} else if i == 20 {
			colorMap["directory_o+w"] =
				getColorFromBsdCode(lsColors[i : i+2])
		}
	}
}

// Write the given Listing's name to the output buffer, with the appropriate
// formatting based on the current options.
func (c *CmdSimpleFSList) writeListingName(outputBuffer *bytes.Buffer, l Listing) {

	if c.options.color {
		appliedColor := false

		numHardlinks, _ := strconv.Atoi(l.numHardLinks)

		// "file.name.txt" -> "*.txt"
		nameSplit := strings.Split(l.name, ".")
		extensionStr := ""
		if len(nameSplit) > 1 {
			extensionStr = fmt.Sprintf("*.%s", nameSplit[len(nameSplit)-1])
		}

		if extensionStr != "" && colorMap[extensionStr] != "" {
			outputBuffer.WriteString(colorMap[extensionStr])
			appliedColor = true
		} else if l.permissions[0] == 'd' &&
			l.permissions[8] == 'w' && l.permissions[9] == 't' {
			outputBuffer.WriteString(colorMap["directory_o+w_sticky"])
			appliedColor = true
		} else if l.permissions[0] == 'd' && l.permissions[9] == 't' {
			outputBuffer.WriteString(colorMap["directory_sticky"])
			appliedColor = true
		} else if l.permissions[0] == 'd' && l.permissions[8] == 'w' {
			outputBuffer.WriteString(colorMap["directory_o+w"])
			appliedColor = true
		} else if l.permissions[0] == 'd' { // directory
			outputBuffer.WriteString(colorMap["directory"])
			appliedColor = true
		} else if numHardlinks > 1 { // multiple hardlinks
			outputBuffer.WriteString(colorMap["multi_hardlink"])
			appliedColor = true
		} else if l.permissions[0] == 'l' && l.linkOrphan { // orphan link
			outputBuffer.WriteString(colorMap["linkOrphan"])
			appliedColor = true
		} else if l.permissions[0] == 'l' { // symlink
			outputBuffer.WriteString(colorMap["symlink"])
			appliedColor = true
		} else if l.permissions[3] == 's' { // setuid
			outputBuffer.WriteString(colorMap["executable_suid"])
			appliedColor = true
		} else if l.permissions[6] == 's' { // setgid
			outputBuffer.WriteString(colorMap["executable_sgid"])
			appliedColor = true
		} else if strings.Contains(l.permissions, "x") { // executable
			outputBuffer.WriteString(colorMap["executable"])
			appliedColor = true
		} else if l.isSocket { // socket
			outputBuffer.WriteString(colorMap["socket"])
			appliedColor = true
		} else if l.isPipe { // pipe
			outputBuffer.WriteString(colorMap["pipe"])
			appliedColor = true
		} else if l.isBlock { // block
			outputBuffer.WriteString(colorMap["block"])
			appliedColor = true
		} else if l.isCharacter { // character
			outputBuffer.WriteString(colorMap["character"])
			appliedColor = true
		}

		outputBuffer.WriteString(l.name)
		if appliedColor {
			outputBuffer.WriteString(colorMap["end"])
		}
	} else {
		outputBuffer.WriteString(l.name)
	}

	if l.permissions[0] == 'l' && c.options.long {
		if l.linkOrphan {
			outputBuffer.WriteString(fmt.Sprintf(" -> %s%s%s",
				colorMap["linkOrphan_target"],
				l.linkName,
				colorMap["end"]))
		} else {
			outputBuffer.WriteString(fmt.Sprintf(" -> %s", l.linkName))
		}
	}
}

// Convert a FileInfoPath object to a Listing.  The dirname is passed for
// following symlinks.
func (c *CmdSimpleFSList) createListing(dirname string, fip FileInfoPath) (Listing, error) {
	var currentListing Listing

	// permissions string
	currentListing.permissions = fip.info.Mode().String()
	if fip.info.Mode()&os.ModeSymlink == os.ModeSymlink {
		currentListing.permissions = strings.Replace(
			currentListing.permissions, "L", "l", 1)
		// Note: don't follow KBFS symlinks for now
	} else if currentListing.permissions[0] == 'D' {
		currentListing.permissions = currentListing.permissions[1:]
	} else if currentListing.permissions[0:2] == "ug" {
		currentListing.permissions =
			strings.Replace(currentListing.permissions, "ug", "-", 1)
		currentListing.permissions = fmt.Sprintf("%ss%ss%s",
			currentListing.permissions[0:3],
			currentListing.permissions[4:6],
			currentListing.permissions[7:])
	} else if currentListing.permissions[0] == 'u' {
		currentListing.permissions =
			strings.Replace(currentListing.permissions, "u", "-", 1)
		currentListing.permissions = fmt.Sprintf("%ss%s",
			currentListing.permissions[0:3],
			currentListing.permissions[4:])
	} else if currentListing.permissions[0] == 'g' {
		currentListing.permissions =
			strings.Replace(currentListing.permissions, "g", "-", 1)
		currentListing.permissions = fmt.Sprintf("%ss%s",
			currentListing.permissions[0:6],
			currentListing.permissions[7:])
	} else if currentListing.permissions[0:2] == "dt" {
		currentListing.permissions =
			strings.Replace(currentListing.permissions, "dt", "d", 1)
		currentListing.permissions = fmt.Sprintf("%st",
			currentListing.permissions[0:len(currentListing.permissions)-1])
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

		sizeStr := ""
		if count == 0 {
			sizeB := int64(size)
			sizeStr = fmt.Sprintf("%d%s", sizeB, suffix)
		} else {
			// looks like the printf formatting automatically rounds up
			sizeStr = fmt.Sprintf("%.1f%s", size, suffix)
		}

		// drop the trailing .0 if it exists in the size
		// e.g. 14.0K -> 14K
		if len(sizeStr) > 3 &&
			sizeStr[len(sizeStr)-3:len(sizeStr)-1] == ".0" {
			sizeStr = sizeStr[0:len(sizeStr)-3] + suffix
		}

		currentListing.size = sizeStr

	} else {
		currentListing.size = fmt.Sprintf("%d", fip.info.Size())
	}

	// epochNano
	currentListing.epochNano = fip.info.ModTime().UnixNano()

	// month
	currentListing.month = fip.info.ModTime().Month().String()[0:3]

	// day
	currentListing.day = fmt.Sprintf("%02d", fip.info.ModTime().Day())

	// time
	// if older than six months, print the year
	// otherwise, print hour:minute
	epochNow := time.Now().Unix()
	var secondsInSixMonths int64 = 182 * 24 * 60 * 60
	epochSixMonthsAgo := epochNow - secondsInSixMonths
	epochModified := fip.info.ModTime().Unix()

	var timeStr string
	if epochModified <= epochSixMonthsAgo ||
		epochModified >= (epochNow+5) {
		timeStr = fmt.Sprintf("%d", fip.info.ModTime().Year())
	} else {
		timeStr = fmt.Sprintf("%02d:%02d",
			fip.info.ModTime().Hour(),
			fip.info.ModTime().Minute())
	}

	currentListing.time = timeStr

	currentListing.name = fip.path

	// character?
	if fip.info.Mode()&os.ModeCharDevice == os.ModeCharDevice {
		currentListing.isCharacter = true
	} else if fip.info.Mode()&os.ModeDevice == os.ModeDevice { // block?
		currentListing.isBlock = true
	} else if fip.info.Mode()&os.ModeNamedPipe == os.ModeNamedPipe { // pipe?
		currentListing.isPipe = true
	} else if fip.info.Mode()&os.ModeSocket == os.ModeSocket { // socket?
		currentListing.isSocket = true
	}

	return currentListing, nil
}

// Comparison function used for sorting Listings by name.
func compareName(a, b Listing) int {
	aNameLower := strings.ToLower(a.name)
	bNameLower := strings.ToLower(b.name)

	var smallerLen int
	if len(a.name) < len(b.name) {
		smallerLen = len(a.name)
	} else {
		smallerLen = len(b.name)
	}

	for i := 0; i < smallerLen; i++ {
		if aNameLower[i] < bNameLower[i] {
			return -1
		} else if aNameLower[i] > bNameLower[i] {
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
func compareTime(a, b Listing) int {
	if a.epochNano >= b.epochNano {
		return -1
	}

	return 1
}

// Comparison function used for sorting Listings by size, from largest to
// smallest.
func compareSize(a, b Listing) int {
	aSize, _ := strconv.Atoi(a.size)
	bSize, _ := strconv.Atoi(b.size)

	if aSize >= bSize {
		return -1
	}

	return 1
}

// Sort the given listings, taking into account the current program options.
func (c *CmdSimpleFSList) sortListings(listings []Listing) {
	comparisonFunction := compareName
	if c.options.sortTime {
		comparisonFunction = compareTime
	} else if c.options.sortSize {
		comparisonFunction = compareSize
	}

	for {
		done := true
		for i := 0; i < len(listings)-1; i++ {
			a := listings[i]
			b := listings[i+1]

			if comparisonFunction(a, b) > -1 {
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

	if c.options.sortReverse {
		middleIndex := (len(listings) / 2)
		if len(listings)%2 == 0 {
			middleIndex--
		}

		for i := 0; i <= middleIndex; i++ {
			frontIndex := i
			rearIndex := len(listings) - 1 - i

			if frontIndex == rearIndex {
				break
			}

			tmp := listings[frontIndex]
			listings[frontIndex] = listings[rearIndex]
			listings[rearIndex] = tmp
		}
	}
}

// Given a set of Listings, print them to the output buffer, taking into account
// the current program arguments and terminal width as necessary.
func (c *CmdSimpleFSList) writeListingsToBuffer(outputBuffer *bytes.Buffer,
	listings []Listing,
	terminalWidth int) {

	if len(listings) == 0 {
		return
	}

	if c.options.long {
		var (
			widthPermissions  int
			widthNumHardLinks int
			widthOwner        int
			widthGroup        int
			widthSize         int
			widthTime         int
		)
		// check max widths for each field
		for _, l := range listings {
			if len(l.permissions) > widthPermissions {
				widthPermissions = len(l.permissions)
			}
			if len(l.numHardLinks) > widthNumHardLinks {
				widthNumHardLinks = len(l.numHardLinks)
			}
			if len(l.owner) > widthOwner {
				widthOwner = len(l.owner)
			}
			if len(l.group) > widthGroup {
				widthGroup = len(l.group)
			}
			if len(l.size) > widthSize {
				widthSize = len(l.size)
			}
			if len(l.time) > widthTime {
				widthTime = len(l.time)
			}
		}

		// now print the listings
		for _, l := range listings {
			// permissions
			outputBuffer.WriteString(l.permissions)
			for i := 0; i < widthPermissions-len(l.permissions); i++ {
				outputBuffer.WriteString(" ")
			}
			outputBuffer.WriteString(" ")

			// number of hard links (right justified)
			for i := 0; i < widthNumHardLinks-len(l.numHardLinks); i++ {
				outputBuffer.WriteString(" ")
			}
			for i := 0; i < 2-widthNumHardLinks; i++ {
				outputBuffer.WriteString(" ")
			}
			outputBuffer.WriteString(l.numHardLinks)
			outputBuffer.WriteString(" ")

			// owner
			outputBuffer.WriteString(l.owner)
			for i := 0; i < widthOwner-len(l.owner); i++ {
				outputBuffer.WriteString(" ")
			}
			outputBuffer.WriteString(" ")

			// group
			outputBuffer.WriteString(l.group)
			for i := 0; i < widthGroup-len(l.group); i++ {
				outputBuffer.WriteString(" ")
			}
			outputBuffer.WriteString(" ")

			// size
			for i := 0; i < widthSize-len(l.size); i++ {
				outputBuffer.WriteString(" ")
			}
			outputBuffer.WriteString(l.size)
			outputBuffer.WriteString(" ")

			// month
			outputBuffer.WriteString(l.month)
			outputBuffer.WriteString(" ")

			// day
			outputBuffer.WriteString(l.day)
			outputBuffer.WriteString(" ")

			// time
			for i := 0; i < widthTime-len(l.time); i++ {
				outputBuffer.WriteString(" ")
			}
			outputBuffer.WriteString(l.time)
			outputBuffer.WriteString(" ")

			// name
			c.writeListingName(outputBuffer, l)
			outputBuffer.WriteString("\n")
		}
	} else if c.options.one {
		separator := "\n"

		for _, l := range listings {
			c.writeListingName(outputBuffer, l)
			outputBuffer.WriteString(separator)
		}
	} else {
		separator := "  "

		// calculate the number of rows needed for column output
		numRows := 1
		var colWidths []int
		for {
			numColsFloat := float64(len(listings)) / float64(numRows)
			numColsFloat = math.Ceil(numColsFloat)
			numCols := int(numColsFloat)

			colWidths = make([]int, numCols)
			for i := range colWidths {
				colWidths[i] = 0
			}

			colListings := make([]int, numCols)
			for i := 0; i < len(colListings); i++ {
				colListings[i] = 0
			}

			// calculate necessary column widths
			// also calculate the number of listings per column
			for i := 0; i < len(listings); i++ {
				col := i / numRows
				if colWidths[col] < len(listings[i].name) {
					colWidths[col] = len(listings[i].name)
				}
				colListings[col]++
			}

			// calculate the maximum width of each row
			maxRowLength := 0
			for i := 0; i < numCols; i++ {
				maxRowLength += colWidths[i]
			}
			maxRowLength += len(separator) * (numCols - 1)

			if maxRowLength > terminalWidth && numRows >= len(listings) {
				break
			} else if maxRowLength > terminalWidth {
				numRows++
			} else {
				listingsInFirstCol := colListings[0]
				listingsInLastCol := colListings[len(colListings)-1]

				// prevent short last (right-hand) columns
				if listingsInLastCol <= listingsInFirstCol/2 &&
					listingsInFirstCol-listingsInLastCol >= 5 {
					numRows++
				} else {
					break
				}
			}
		}

		for r := 0; r < numRows; r++ {
			for i, l := range listings {
				if i%numRows == r {
					c.writeListingName(outputBuffer, l)
					for s := 0; s < colWidths[i/numRows]-len(l.name); s++ {
						outputBuffer.WriteString(" ")
					}
					outputBuffer.WriteString(separator)
				}
			}
			if len(listings) > 0 {
				outputBuffer.Truncate(outputBuffer.Len() - len(separator))
			}
			outputBuffer.WriteString("\n")
		}
	}
}

// Parse the program arguments and write the appropriate listings to the output
// buffer.
func (c *CmdSimpleFSList) ls(outputBuffer *bytes.Buffer, listResult keybase1.SimpleFSListResult, width int) error {
	listDirs := make([]Listing, 0)
	listFiles := make([]Listing, 0)

	//
	// determine color output
	//

	if c.options.color {
		colorMap = make(map[string]string)
		colorMap["end"] = "\x1b[0m"

		lsUnderscoreColors := os.Getenv("LS_COLORS")
		lsColors := os.Getenv("LSCOLORS")

		if lsColors != "" {
			parseLsColors(lsColors)
		} else if lsUnderscoreColors != "" {
			// parse lsUnderscoreColors
			lsColorsSplit := strings.Split(lsUnderscoreColors, ":")
			for _, i := range lsColorsSplit {
				if i == "" {
					continue
				}

				iSplit := strings.Split(i, "=")
				colorCode := fmt.Sprintf("\x1b[%sm", iSplit[1])

				if iSplit[0] == "rs" {
					colorMap["end"] = colorCode
				} else if iSplit[0] == "di" {
					colorMap["directory"] = colorCode
				} else if iSplit[0] == "ln" {
					colorMap["symlink"] = colorCode
				} else if iSplit[0] == "mh" {
					colorMap["multi_hardlink"] = colorCode
				} else if iSplit[0] == "pi" {
					colorMap["pipe"] = colorCode
				} else if iSplit[0] == "so" {
					colorMap["socket"] = colorCode
				} else if iSplit[0] == "bd" {
					colorMap["block"] = colorCode
				} else if iSplit[0] == "cd" {
					colorMap["character"] = colorCode
				} else if iSplit[0] == "or" {
					colorMap["linkOrphan"] = colorCode
				} else if iSplit[0] == "mi" {
					colorMap["linkOrphan_target"] = colorCode
				} else if iSplit[0] == "su" {
					colorMap["executable_suid"] = colorCode
				} else if iSplit[0] == "sg" {
					colorMap["executable_sgid"] = colorCode
				} else if iSplit[0] == "tw" {
					colorMap["directory_o+w_sticky"] = colorCode
				} else if iSplit[0] == "ow" {
					colorMap["directory_o+w"] = colorCode
				} else if iSplit[0] == "st" {
					colorMap["directory_sticky"] = colorCode
				} else if iSplit[0] == "ex" {
					colorMap["executable"] = colorCode
				} else {
					colorMap[iSplit[0]] = colorCode
				}

				// ca - CAPABILITY? -- not supported!
				// do - DOOR -- not supported!
			}
		} else {
			// use the default LSCOLORS
			parseLsColors("exfxcxdxbxegedabagacad")
		}
	}

	for _, e := range listResult.Entries {

		//
		// separate the files from the directories
		//
		//	for _, f := range args_files {
		//info, err := os.Stat(f)

		fListing, err := c.createListing("",
			FileInfoPath{path: e.Name,
				info: DirentFileInfo{e}})
		if err != nil {
			return err
		}

		// for option_dir (-d), treat directories like regular files
		if c.options.dir {
			listFiles = append(listFiles, fListing)
		} else { // else, separate the files and directories
			if e.DirentType == keybase1.DirentType_DIR {
				listDirs = append(listDirs, fListing)
			} else {
				listFiles = append(listFiles, fListing)
			}
		}
	}

	numFiles := len(listFiles)
	numDirs := len(listDirs)

	// sort the lists if necessary
	c.sortListings(listFiles)
	c.sortListings(listDirs)

	//
	// list the files first (unless --dirs-first)
	//
	if numFiles > 0 && !c.options.dirsFirst {
		c.writeListingsToBuffer(outputBuffer,
			listFiles,
			width)
	}

	//
	// then list the directories
	//
	if numDirs > 0 {
		c.writeListingsToBuffer(outputBuffer,
			listDirs,
			width)
	}
	//
	// list the files now if --dirs-first
	//
	if numFiles > 0 && c.options.dirsFirst {
		c.writeListingsToBuffer(outputBuffer,
			listFiles,
			width)
	}

	return nil
}
