require 'fileutils'
require 'json'

dir = "/Users/gabe/Pictures/Streamline - PNG/PNG Outline"
#style = "black"
icons_dirname = "Streamline-Outline"
includes = ["lock-4", "arrow-67", "arrow-65"]

script_path = File.expand_path(File.dirname(__FILE__))
assets_path = "#{script_path}/Images.xcassets/#{icons_dirname}"

FileUtils.rm_rf assets_path
FileUtils.mkdir_p assets_path

Dir["#{dir}/**/*"].each do |path|

  if path.end_with?(".png")
    name = File.basename(path)
    dirname = File.dirname(path)

    dirs = dirname.split("/")
    size = dirs[-1]
    color = dirs[-2]
    category = dirs[-3]

    #next if color != style #black/white
    next if size != "24px"

    ext = File.extname(name)
    bname = File.basename(name, ext)

    next unless includes.include?(bname)

    asset_dirname = "#{category}-#{color}-#{bname}"

    sizes = [
      ["24", [["24", "1x"], ["48", "2x"]]],
      ["30", [["30", "1x"], ["60", "2x"], ["90", "3x"]]]
    ]

    sizes.each do |spx, pxscale|
      images = []
      imageset_dir = "#{assets_path}/#{asset_dirname}-#{spx}.imageset"
      FileUtils.mkdir_p imageset_dir

      pxscale.each do |px, sc|
        dirs[-1] = "#{px}px"
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
