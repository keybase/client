require "colorize"
require "pathname"
require "test/engine"

#
# test dsl
#
module Test
  @@total, @@failures = 0, 0
  @@tests = []

  # start of a test case
  def self.test(name, opts)
    @test = name.to_s
    return if opts[:skip]
    return unless run_test?(@test)
    @@total += 1

    # create the users and setup the folder parameters
    users = opts[:writers]
    users += opts[:readers] if opts[:readers]
    num_writers = opts[:writers].size
    block_size = 0
    if opts[:block_size] then
      block_size = opts[:block_size]
    end
    block_change_size = 0
    if opts[:block_change_size] then
      block_change_size = opts[:block_change_size]
    end
    @users = Engine.init_test(block_size, block_change_size, users)
    @is_public = opts[:is_public] || false
    @writers = @users[0, num_writers].map{|user| Engine.get_uid(user) }
    @readers = []
    if opts[:readers]
      readers = @users[num_writers, @users.size-num_writers]
      @readers = readers.map{|user| Engine.get_uid(user) }
    end

    begin
      # "as alice do"
      def self.as(user, opts=nil)
        @user = user
        @root_dir, err = Engine.get_root_dir(@user, @is_public, @writers, @readers)
        raise "as: #{err}" if err

        # sync with the mdserver
        sync = true
        sync = opts[:sync] if opts
        if sync
          err = Engine.sync_from_server(@user, @root_dir)
          raise "sync from server: #{err}" if err
        end

        # mkfile "a/foo.txt", "hello world"
        def self.mkfile(name, data, opts=nil)
          raise_unless_expected(opts, __method__) do
            file = get_node(name, true, true)
            err = Engine.write_file(@user, file, data, 0)
            raise err if err
          end
        end

        # link "a/b.link", "a/b"
        def self.link(from_name, to_path, opts=nil)
          nodes = from_name.split("/")
          name = nodes.pop
          path = nodes.join("/")
          raise_unless_expected(opts, __method__) do
            parent = get_node(path, false, false)
            err = Engine.create_link(@user, parent, name, to_path)
            raise err if err
          end
        end

        # mkdir "a/b"
        def self.mkdir(name, opts=nil)
          raise_unless_expected(opts, __method__) do
            get_node(name, true, false)
          end
        end

        # rm "a/foo.txt"
        def self.rm(path, opts=nil)
          nodes = path.split("/")
          name = nodes.pop
          path = nodes.join("/")
          raise_unless_expected(opts, __method__) do
            parent = get_node(path, false, false)
            err = Engine.remove_entry(@user, parent, name)
            raise err if err
          end
        end

        # rmdir "a/b"
        def self.rmdir(dir, opts=nil)
          nodes = dir.split("/")
          name = nodes.pop
          path = nodes.join("/")
          raise_unless_expected(opts, __method__) do
            parent = get_node(path, false, false)
            err = Engine.remove_dir(@user, parent, name)
            raise err if err
          end
        end

        # rename "a/b", "b/a"
        def self.rename(src, dst, opts=nil)
          src_nodes = src.split("/")
          dst_nodes = dst.split("/")
          src_name = src_nodes.pop
          dst_name = dst_nodes.pop
          src_path = src_nodes.join("/")
          dst_path = dst_nodes.join("/")
          raise_unless_expected(opts, __method__) do
            src_folder = get_node(src_path, false, false)
            dst_folder = get_node(dst_path, true, false)
            err = Engine.rename(@user, src_folder, src_name, dst_folder, dst_name)
            raise err if err
          end
        end

        # read "a/foo.txt", "hello world"
        def self.read(name, data, opts=nil)
          raise_unless_expected(opts, __method__) do
            file = get_node(name, false, true)
            found, err = Engine.read_file(@user, file, 0, data.size)
            raise err if err
            raise "expected: '#{data}', got: '#{found}'}" if data != found
          end
        end

        # write "a/foo.txt", "bar"
        def self.write(name, data, opts=nil)
          raise_unless_expected(opts, __method__) do
            file = get_node(name, true, true)
            err = Engine.write_file(@user, file, data, 0, opts)
            raise err if err
          end
        end

        # sync "a/foo.txt"
        def self.sync(name, opts=nil)
          nodes = name.split("/")
          name = nodes.pop
          path = nodes.join("/")
          raise_unless_expected(opts, __method__) do
            parent = get_node(path, false, false)
            file, _, err = Engine.lookup(@user, folder, name)
            raise err if err
            err = Engine.sync(@user, file)
            raise err if err
          end
        end

        # lsdir "a/", { "foo.*" => "DIR", "bar\.t.t" => "FILE" }
        def self.lsdir(name, files, opts=nil)
          raise_unless_expected(opts, __method__) do
            folder = get_node(name, false, false)
            entries, err = Engine.get_dir_children(@user, folder)
            raise err if err
            # make sure all expected files are found
            left = entries.clone
            files.each do |regex, expectedType|
              matched = false
              entries.each do |node, type|
                m = Regexp.new(regex).match(node) && type == expectedType
                left.delete(node) if m
                matched ||= m
              end
              raise "#{regex} of type #{expectedType} not found" unless matched
            end
            # make sure no unexpected files exist
            if left.size > 0
              node = left.keys[0]
              type = left[node]
              raise "unexpected #{node} of type #{type} found in #{name}"
            end
          end
        end

        # exists "c/d" (works for directories or files)
        def self.exists(name, opts=nil)
          nodes = name.split("/")
          name = nodes.pop
          path = nodes.join("/")
          raise_unless_expected(opts, __method__) do
            folder = get_node(path, false, false)
            _, _, err = Engine.lookup(@user, folder, name)
            raise err if err
          end
        end

        # not_exists "c/d"
        def self.not_exists(name)
          node = name.split("/").pop
          exists(name, error: "#{node} doesn't exist")
        end

        # setex "a/foo.exe", true
        def self.setex(name, ex, opts=nil)
          raise_unless_expected(opts, __method__) do
            file = get_node(name, false, true)
            err = Engine.setex(@user, file, ex)
            raise err if err
          end
        end

        # disable metadata update notifications
        def self.disable_updates(opts=nil)
          raise_unless_expected(opts, __method__) do
            err = Engine.disable_updates(@user, @root_dir)
            raise err if err
          end
        end

        # reenable updates
        def self.reenable_updates(opts=nil)
          raise_unless_expected(opts, __method__) do
            Engine.reenable_updates(@user, @root_dir)
            err = Engine.sync_from_server(@user, @root_dir)
            raise err if err
          end
        end

        # check that state is consistent
        def self.check_state(opts=nil)
          raise_unless_expected(opts, __method__) do
            err = Engine.check_state(@user, @root_dir)
            raise err if err
          end
        end

        # helper to support conditional exceptions
        def self.raise_unless_expected(opts, prefix)
          caught = false
          begin
            yield
          rescue => e
            unless opts && opts[:error] && e.message == opts[:error]
              raise "#{prefix}: #{e}"
            end
            caught = true
          end
          if opts && opts[:error] && !caught
            raise "#{prefix}: missing expected error: '#{opts[:error]}'"
          end
        end

        # helper to take a step in a walk down a directory path
        def self.next_node(parent, name, create, is_file, parent_path)
          node, sym_path, err = Engine.lookup(@user, parent, name)
          if err
            if create
              if is_file
                node, err = Engine.create_file(@user, parent, name)
              else
                node, err = Engine.create_dir(@user, parent, name)
              end
            end
            raise err if err
          elsif sym_path && sym_path.size != 0
            # follow the symlink
            path = Pathname.new(File.join(parent_path, sym_path)).cleanpath()
            node = get_node(path.to_s(), create, is_file)
          end
          node
        end

        # helper to get/create a node given a path
        def self.get_node(path, create, is_file)
          return @root_dir if path.empty?
          nodes = path.split("/")
          name = nodes.pop
          parent = @root_dir
          parent_path = ""
          nodes.each do |node|
            parent = next_node(parent, node, create, false, parent_path)
            parent_path += node + "/"
          end
          next_node(parent, name, create, is_file, parent_path)
        end

        yield(@user)
      end

      yield(@users)

    rescue => e
      @@failures += 1
      msg = "failed: " + e.message
      printf "%-50s: %s\n", @test, msg.red
      puts e.backtrace if ENV["DUMP_STACK"]
      Engine.print_log()
    else
      printf "%-50s: %s\n", @test, "success".green
    ensure
      @users.each{|user| Engine.shutdown(user) }
    end
  end

  def self.total
    @@total
  end

  def self.failures
    @@failures
  end

  def self.run_test?(name)
    # assume we run everything if empty
    return true if @@tests.empty?
    @@tests.include?(name)
  end

  def self.include_test(name)
    @@tests << name
  end
end
