#!/usr/bin/env bash

# Format bytes into human-readable size (GB, MB, KB, or B)
format_size() {
	local size="$1"
	if [ "$size" -ge 1073741824 ]; then
		awk "BEGIN {printf \"%.2f GB\", $size/1073741824}"
	elif [ "$size" -ge 1048576 ]; then
		awk "BEGIN {printf \"%.2f MB\", $size/1048576}"
	elif [ "$size" -ge 1024 ]; then
		awk "BEGIN {printf \"%.2f KB\", $size/1024}"
	else
		echo "${size} B"
	fi
}

# Cleanup old packages from S3
# Deletes packages older than retention_days, but always keeps the latest keep_latest files
# Usage: cleanup_old_packages <prefix> [retention_days] [keep_latest]
# Requires: bucket_name environment variable to be set
cleanup_old_packages() {
	local prefix="$1"
	local retention_days="${2:-7}"
	local keep_latest="${3:-5}"

	# shellcheck disable=SC2154
	if [ "${bucket_name:-}" = "" ]; then
		return
	fi

	# shellcheck disable=SC2154
	echo "Cleaning up old packages in s3://${bucket_name}/${prefix} (retention: ${retention_days} days, keep latest: ${keep_latest} files)"

	# Calculate cutoff date (retention_days ago)
	local cutoff_timestamp
	if [[ "$OSTYPE" == "darwin"* ]]; then
		# macOS date command
		cutoff_timestamp=$(date -v-"${retention_days}"d +%s 2>/dev/null || date -j -v-"${retention_days}"d +%s)
	else
		# Linux date command
		cutoff_timestamp=$(date -d "${retention_days} days ago" +%s)
	fi

	# List all objects in the prefix
	local listing
	# shellcheck disable=SC2154
	listing=$(s3cmd ls -r "s3://${bucket_name}/${prefix}" 2>/dev/null || true)
	if [ -z "$listing" ]; then
		echo "  No objects found in $prefix"
		return
	fi

	# Parse listing and build list of files with timestamps and sizes
	# s3cmd ls -r output format: "2024-01-15 10:30:45    12345678  s3://bucket/prefix/file.ext"
	local files_with_timestamps=""
	while IFS= read -r line; do
		# Extract date, size, and file path
		local date_str time_str size path
		read -r date_str time_str size path <<< "$line"

		if [ -z "$path" ]; then
			continue
		fi

			# Convert date to timestamp
		# s3cmd output can be either "HH:MM:SS" or "HH:MM" format
		local file_timestamp
		if [[ "$OSTYPE" == "darwin"* ]]; then
			# macOS: try with seconds first, then without
			file_timestamp=$(date -j -f "%Y-%m-%d %H:%M:%S" "${date_str} ${time_str}" +%s 2>/dev/null || \
				date -j -f "%Y-%m-%d %H:%M" "${date_str} ${time_str}" +%s 2>/dev/null || echo "0")
		else
			# Linux: try with seconds first, then append :00 if needed
			file_timestamp=$(date -d "${date_str} ${time_str}" +%s 2>/dev/null || \
				date -d "${date_str} ${time_str}:00" +%s 2>/dev/null || echo "0")
		fi

		if [ "$file_timestamp" != "0" ]; then
			# Format: timestamp size path (for sorting and size tracking)
			files_with_timestamps="${files_with_timestamps}${file_timestamp} ${size} ${path}"$'\n'
		fi
	done <<< "$listing"

	# Sort by timestamp (newest first) and get the latest keep_latest files
	local latest_files
	latest_files=$(echo "$files_with_timestamps" | sort -rn | head -n "$keep_latest" | awk '{print $3}')

	# Delete old files
	local deleted_count=0
	local total_deleted_size=0
	while IFS= read -r line; do
		local timestamp size path
		read -r timestamp size path <<< "$line"

		if [ -z "$path" ]; then
			continue
		fi

		# Check if this file should be kept (in latest N)
		# Use grep to check if path is in latest_files list
		# -F: fixed strings (treat pattern as literal, not regex)
		# -x: match whole line only
		# -q: quiet mode (no output, just return exit status)
		if echo "$latest_files" | grep -Fxq "$path" 2>/dev/null; then
			continue
		fi

		# Delete if older than cutoff
		if [ "$timestamp" -lt "$cutoff_timestamp" ]; then
			local age_days=$(( ($(date +%s) - timestamp) / 86400 ))
			echo "  Deleting old file: $path (age: ${age_days} days, size: $(format_size "$size"))"
			((deleted_count++))
			total_deleted_size=$((total_deleted_size + size))
			# if s3cmd del "$path" 2>/dev/null; then
			# 	# Deletion successful (already counted above)
			# else
			# 	echo "    Warning: Failed to delete $path"
			# fi
		fi
	done <<< "$files_with_timestamps"

	if [ "$deleted_count" -gt 0 ]; then
		echo "  Deleted $deleted_count old file(s) from $prefix (total size: $(format_size "$total_deleted_size"))"
	else
		echo "  No old files to delete in $prefix"
	fi
}
