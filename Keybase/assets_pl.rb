require 'fileutils'
require 'json'

dir = "/Users/gabe/Pictures/pixellove_pro/PNG"
#style = "black"
icons_dirname = "PixelLove"
includes = ["Twitter", "Github", "Reddit"]

script_path = File.expand_path(File.dirname(__FILE__))
assets_path = "#{script_path}/Images.xcassets/#{icons_dirname}"

FileUtils.rm_rf assets_path
FileUtils.mkdir_p assets_path

Dir["#{dir}/**/*"].each do |path|

  if path.end_with?(".png")
    name = File.basename(path)
    dirname = File.dirname(path)

    dirs = dirname.split("/")

    size = "1x"
    typesize = dirs[-2]
    if typesize.end_with?("@2x")
      typesize[0...-3]
      size = "2x"
    else

    end
    category = dirs[-1]

    ext = File.extname(name)
    bname = File.basename(name, ext)

    next unless includes.include?(bname)

    asset_dirname = "#{category}-#{typesize}-#{bname}"

    sizes = [
      ["25", [["25", "1x"], ["50", "2x"]]],
    ]

    sizes.each do |spx, pxscale|
      images = []
      imageset_dir = "#{assets_path}/#{asset_dirname}-#{spx}.imageset"
      FileUtils.mkdir_p imageset_dir

      pxscale.each do |px, sc|
        if sc == "2x"
          name = "#{bname}@2x#{ext}"
          dirs[-2] = "#{typesize}@2x"
        else
          dirs[-2] = typesize
        end

        src = (dirs + [name]).join("/")
        next unless File.exist?(src)

        dest = "#{imageset_dir}/#{bname}@#{sc}#{ext}"
        #puts "cp #{src} to #{dest}"
        puts dest
        FileUtils.cp src, dest

        images << {"idiom" => "universal", "scale" => sc, "filename" => "#{bname}@#{sc}#{ext}"}
      end

      d = {"images" => images, "info" => {"version" => 1, "author" => "xcode"}}
      File.open("#{imageset_dir}/Contents.json", 'w') { |file| file.write(d.to_json) }
    end

  end

end
