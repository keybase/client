#!/usr/bin/env ruby
require 'time'
require_relative 'sparkle'

appcast = Screenhero::Sparkle::AppCast.new(
	name: "Keybase",
	description: "Keybase updates",
	appcast_url: "https://keybase-app.s3.amazonaws.com/appcast.xml")


appcast.add_item(
	"0.1.7",
	"../Keybase-0.1.7.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.5.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.5.html",
	Time.parse("2015-03-30 5:31 PM"))



File.write("site/appcast.xml", appcast.to_s)

