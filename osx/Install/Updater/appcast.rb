#!/usr/bin/env ruby
require 'time'
require_relative 'sparkle'

host = "https://keybase-app.s3.amazonaws.com"

appcast = Screenhero::Sparkle::AppCast.new(
	name: "Keybase",
	description: "Keybase updates",
	appcast_url: "#{host}/appcast.xml")

version = ARGV[0]

if !version
	put "Specify a version."
	exit
end

dmg_name = "Keybase-#{version}.dmg"
dmg_file = "../#{dmg_name}"
release_html = "Keybase-#{version}.html"
dmg_time = File.ctime(dmg_file)

item = Screenhero::Sparkle::AppCast::Item.new(
	update_path: dmg_file,
	version: version,
	update_url: "#{host}/#{dmg_name}",
	release_notes_url: "#{host}/#{release_html}",
	publish_date: dmg_time)

formatter = REXML::Formatters::Pretty.new(2)
formatter.compact = true
item_xml = formatter.write(item.xml, "")

puts <<-EOS

Add the following to the appcast.xml:

#{item_xml}
EOS

