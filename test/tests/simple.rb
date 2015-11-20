# These tests all do one conflict-free operation while a user is unstaged.
module Test
  # Check that renaming over a file correctly cleans up state
  test :rename_file_over_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
      mkfile "a/c", "world"
      rename "a/c", "a/b"
      lsdir "a/", { "b" => "FILE" }
      read "a/b", "world"
    end
  end

  # Check that renaming a directory over a file correctly cleans up state
  test :rename_dir_over_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
      mkfile "a/c/d", "world"
      rename "a/c", "a/b"
      lsdir "a/", { "b" => "DIR" }
      read "a/b/d", "world"
    end
  end
end
