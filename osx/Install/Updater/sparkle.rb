require 'openssl'
require 'base64'
require 'rexml/document'

module Screenhero
  module Sparkle
    class AppCast
      class Item
        def initialize(name: '', update_path: '', version: '0.0.0',
          publish_date: Time.now, update_url: '', release_notes_url: '',
          dsa_priv: nil, minimum_system_version: nil)

          @name = name
          @update_path = update_path
          @version = version
          @publish_date = publish_date
          @update_url = update_url
          @release_notes_url = release_notes_url
          @dsa_priv = dsa_priv
          @dsa_signature = nil
          @update_signature = nil
          @update_length = nil
          @minimum_system_version = minimum_system_version
          @xml = REXML::Element.new("item")

          generate_dsa_signature! if @dsa_priv
          generate_xml!
        end

        attr_reader :update_signature, :update_length, :xml

        def generate_dsa_signature!
          dsa = OpenSSL::PKey::DSA.new(@dsa_priv)
          sha1 = OpenSSL::Digest::SHA1.new
          digest = OpenSSL::Digest::DSS1.new
          cksum = nil
          File.open(@update_path, File::RDONLY, :binmode => true) do |f|
            data = f.read
            cksum = sha1.digest(data)
            signature = dsa.sign(digest, cksum)
            @update_signature = Base64.encode64(signature).gsub(/\s+/, '')
            @update_length = data.length
          end
        end

        def generate_xml!
          item = @xml

          item.add_element("title").add_text("#{@name} #{@version}")
          item.add_element("sparkle:minimumSystemVersion").add_text(@minimum_system_version) if @minimum_system_version
          item.add_element("sparkle:releaseNotesLink").add_text("#{@release_notes_url}")
          item.add_element("pubDate").add_text(@publish_date.strftime("%a, %d %h %Y %H:%M:%S %z"))

          guid = item.add_element("guid")
          guid.attributes["isPermaLink"] = "false"
          guid.add_text("#{@name} #{@version}")

          enclosure = item.add_element("enclosure")
          enclosure.attributes["type"] = "application/dmg" #DMG only for now
          enclosure.attributes["sparkle:version"] = @version
          enclosure.attributes["length"] = @update_length
          enclosure.attributes["sparkle:dsaSignature"] = @update_signature
          enclosure.attributes["url"] = @update_url
        end

        def to_s
          formatter = REXML::Formatters::Pretty.new(2)
          formatter.compact = true
          ret = ""
          formatter.write(doc, ret)

          return ret
        end

      end

      def initialize(name: 'Screenhero', language: 'en',
          publish_date: Time.now, description: '', dsa_priv: nil,
          appcast_url: '')
        @name = name
        @version = version
        @language = language
        @publish_date = publish_date
        @description = description
        @dsa_priv = dsa_priv
        @appcast_url = appcast_url
        @xml = REXML::Document.new

        generate_appcast_xml!
      end

      attr_accessor :name, :version, :language, :publish_date, :description,
              :dsa_priv

      def generate_appcast_xml!
        rss = @xml.add_element("rss")
        rss.attributes["xmlns:sparkle"] = "http://www.andymatuschak.org/xml-namespaces/sparkle"
        rss.attributes["xmlns:atom"] = "http://www.andymatuschak.org/xml-namespaces/sparkle"
        rss.attributes["version"] = "2.0"

        channel = rss.add_element "channel"
        channel.add_element("title").add_text(@name)
        channel.add_element("description").add_text(@description)
        channel.add_element("language").add_text(@language)
        channel.add_element("pubDate").add_text(@publish_date.strftime("%a, %d %h %Y %H:%M:%S %z"))
        channel.add_element("link").add_text(@appcast_url)

        atom = channel.add_element("atom:link")
        atom.attributes["rel"] = "self"
        atom.attributes["type"] = "application/rss+xml"
        atom.attributes["href"] = @appcast_url
      end

      def add_item(version, update_path, update_url, release_notes_url, publish_date)
        @xml.elements["/rss/channel"] << Item.new(name: @name, update_path: update_path,
          version: version, release_notes_url: release_notes_url,
          update_url: update_url, dsa_priv: @dsa_priv, publish_date: publish_date).xml
      end

      def to_s
        formatter = REXML::Formatters::Pretty.new(2)
        formatter.compact = true
        ret = %Q(<?xml version="1.0" encoding="UTF-8"?>\n)
        formatter.write(@xml, ret)

        return ret
      end
    end
  end
end
