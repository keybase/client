require "ffi"

#
# Engine glue layer between ruby and go
#
module Test
  module Engine
    # golang: interface{}
    class GoInterface < FFI::Struct
      layout :t, :pointer,
             :v, :pointer
    end

    class GoInterfaceArray < FFI::Struct
      layout :size, :long_long,
             :array, :pointer

      # convert to a ruby array
      def to_a
        interfaces = []
        num_ptrs = self[:size] * GoInterface.size / FFI::Pointer::SIZE
        ptrs = self[:array].read_array_of_pointer(num_ptrs)
        ptrs.each_slice(2) do |ptr|
          interface = GoInterface.new
          interface[:t] = ptr[0]
          interface[:v] = ptr[1]
          interfaces << interface
        end
        interfaces
      end
    end

    # used to pass an array of strings to glang
    class StringArray < FFI::Struct
      layout :size, :long_long,
             :array, :pointer
      # Hold direct references to element memory pointers, so they
      # don't get garbage collected.
      @ptrs = []

      # create from a ruby array
      def self.from_a(array)
        strings = FFI::MemoryPointer.new(:pointer, array.size)
        array.each_with_index do |s,i|
          ptr = FFI::MemoryPointer.from_string(s)
          strings[i].put_pointer(0, ptr)
          @ptrs << ptr
        end
        arg = StringArray.new
        arg[:size] = array.size
        arg[:array] = strings
        arg
      end

      # convert to a ruby array
      def to_a
        return [] if self[:size] == 0
        ptrs = self[:array].read_array_of_pointer(self[:size])
        ptrs.map{|ptr| ptr.read_string }
      end
    end

    #
    # various return types
    #
    class GetRootDirReturn < FFI::Struct
      layout :r0, GoInterface.by_value,
             :r1, :string
    end

    class CreateDirReturn < FFI::Struct
      layout :r0, GoInterface.by_value,
             :r1, :string
    end

    class CreateFileReturn < FFI::Struct
      layout :r0, GoInterface.by_value,
             :r1, :string
    end

    class LookupReturn < FFI::Struct
      layout :r0, GoInterface.by_value,
             :r1, :string,
             :r2, :string
    end

    class ReadFileReturn < FFI::Struct
      layout :r0, :string,
             :r1, :string
    end

    extend FFI::Library
    ffi_lib "ext/engine.so"

    # typedefs
    typedef StringArray.by_ref, :strings
    typedef GoInterface.by_value, :interface
    typedef GoInterfaceArray.by_ref, :interfaces
    typedef GetRootDirReturn.by_value, :get_root_dir_return
    typedef CreateDirReturn.by_value, :create_dir_return
    typedef CreateFileReturn.by_value, :create_file_return
    typedef LookupReturn.by_value, :lookup_return
    typedef ReadFileReturn.by_value, :read_file_return

    # exported function mappings
    attach_function :Init, [:string], :bool
    attach_function :InitTest, [:long_long, :long_long, :strings], :interfaces
    attach_function :GetUID, [:interface], :string
    attach_function :GetRootDir, [:interface, :bool, :strings, :strings], :get_root_dir_return
    attach_function :CreateDir, [:interface, :interface, :string], :create_dir_return
    attach_function :CreateFile, [:interface, :interface, :string], :create_file_return
    attach_function :CreateLink, [:interface, :interface, :string, :string], :string
    attach_function :RemoveDir, [:interface, :interface, :string], :string
    attach_function :RemoveEntry, [:interface, :interface, :string], :string
    attach_function :Rename, [:interface, :interface, :string, :interface, :string], :string
    attach_function :Lookup, [:interface, :interface, :string], :lookup_return
    attach_function :WriteFile, [:interface, :interface, :string, :long_long, :bool], :string
    attach_function :Sync, [:interface, :interface], :string
    attach_function :ReadFile, [:interface, :interface, :long_long, :long_long], :read_file_return
    attach_function :GetDirChildrenTypes, [:interface, :interface], :strings, :string
    attach_function :SetEx, [:interface, :interface, :bool], :string
    attach_function :DisableUpdatesForTesting, [:interface, :interface], :string
    attach_function :ReenableUpdates, [:interface, :interface], :void
    attach_function :SyncFromServer, [:interface, :interface], :string
    attach_function :Shutdown, [:interface], :void
    attach_function :PrintLog, [], :void
    attach_function :CheckState, [:interface, :interface], :string

    # initialize. TODO: support other engines.
    raise "unable to load engine" unless Init("libkbfs")

    #
    # cleaner interfaces for the above
    #
    def self.init_test(block_size, block_change_size, users)
      InitTest(block_size, block_change_size, StringArray.from_a(users)).to_a
    end

    def self.get_uid(u)
      GetUID(u)
    end

    def self.get_root_dir(u, is_public, writers, readers)
      r = GetRootDir(u, is_public, StringArray.from_a(writers), StringArray.from_a(readers))
      [ r[:r0], r[:r1] ]
    end

    def self.create_dir(u, parent, name)
      r = CreateDir(u, parent, name)
      [ r[:r0], r[:r1] ]
    end

    def self.create_file(u, dir, name)
      r = CreateFile(u, dir, name)
      [ r[:r0], r[:r1] ]
    end

    def self.create_link(u, dir, from_name, to_path)
      CreateLink(u, dir, from_name, to_path)
    end

    def self.remove_dir(u, dir, name)
      RemoveDir(u, dir, name)
    end

    def self.remove_entry(u, dir, name)
      RemoveEntry(u, dir, name)
    end

    def self.rename(u, src_parent, src_name, dst_parent, dst_name)
      Rename(u, src_parent, src_name, dst_parent, dst_name)
    end

    def self.lookup(u, dir, name)
      r = Lookup(u, dir, name)
      [ r[:r0], r[:r1], r[:r2] ]
    end

    def self.write_file(u, file, data, off, opts=nil)
      sync = true
      sync = opts[:sync] if opts
      WriteFile(u, file, data, off, sync)
    end

    def self.sync(u, file)
      Sync(u, file)
    end

    def self.read_file(u, file, off, len)
      r = ReadFile(u, file, off, len)
      [ r[:r0], r[:r1] ]
    end

    def self.get_dir_children_types(u, dir)
      entries = {}
      children, err = GetDirChildrenTypes(u, dir)
      return [ entries, err ] if err
      children.to_a.each_slice(2) do |name, type|
        entries[name] = type
      end
      [ entries, nil ]
    end

    def self.setex(u, file, ex)
      SetEx(u, file, ex)
    end

    def self.disable_updates(u, dir)
      DisableUpdatesForTesting(u, dir)
    end

    def self.reenable_updates(u, dir)
      ReenableUpdates(u, dir)
    end

    def self.sync_from_server(u, dir)
      SyncFromServer(u, dir)
    end

    def self.shutdown(u)
      Shutdown(u)
    end

    def self.print_log()
      PrintLog()
    end

    def self.check_state(u, dir)
      CheckState(u, dir)
    end
  end
end
