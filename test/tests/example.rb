module Test
  #
  # 1) alice writes
  # 2) bob reads
  # 3) alice reads
  # 4) eve reads & tries to write w/o permission
  #
  test :write_read_write_fail, writers: ["alice", "bob"], readers: ["eve"] do |alice, bob, eve|
    as alice do
      mkfile "foo.txt", "hello world"
    end
    as bob do
      read "foo.txt", "hello world"
    end
    as alice do
      read "foo.txt", "hello world"
    end
    as eve do
      read "foo.txt", "hello world"
      rm "foo.txt", error: "eve does not have write access to directory alice,bob#eve"
      check_state
    end
  end

  #
  # 1) alice creates a directory, creates a file, writes more to the file w/o sync
  # 2) bob writes to the same file and syncs
  # 3) alice syncs
  #
  test :conflict, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "world"
    end
    as bob, sync: false do
      write "a/b", "uh oh"
      reenable_updates error: "Conflict resolution didn't take us out of staging."
      # Can uncomment out the below when conflict resolution is complete.
      # lsdir "a/", { "b" => "FILE", "b.conflict.*" => "FILE" }
    end
  end

  # create a file, create a dir, link to the file, rename a file, remove it, remove its parent directory
  # and create an executable file.
  test :link_ls_rename_rm_rmdir_setex, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello world"
      mkdir "a/e"
      link "a/e/b.link", "a/b"
      link "a/f", "a/e"
      lsdir "a/", { "b" => "FILE", "e" => "DIR", "f" => "SYM" }
      lsdir "a/", { "b" => "DIR", "e" => "DIR", "f" => "SYM" }, error: "b of type DIR not found"
      # lsdir looks for files in the directory that match regexs from left to right in this hash.
      # if it finds a match for the regex and the expected type it considers the file expected.
      # if it doesn't find a match it throws an error. also, if any files remain that weren't
      # matched an error is also thrown.
      lsdir "a/", { "." => "FILE", "[a-z]{1}" => "DIR", "[a-f]{1}" => "SYM" }
      lsdir "a/", { "b" => "FILE", "e" => "DIR" }, error: "unexpected f of type SYM found"
      lsdir "a/e", { "b.link" => "SYM" }
      lsdir "a/f", { "b.link" => "SYM" }
    end
    as bob do
      read "a/e/b.link", "hello world"
      rename "a/b", "c/d"
      read "a/e/b.link", "hello world", error: "b doesn't exist"
      rm "a/e/b.link"
      exists "c/d"
    end
    as alice do
      not_exists "a/b"
      not_exists "a/e/b.link"
      read "a/b", "hello world", error: "b doesn't exist"
      read "c/d", "hello world"
      rm "c/d"
      not_exists "c/d"
      rmdir "c/"
    end
    as bob do
      not_exists "c/"
      mkfile "a/foo.exe", "bits and bytes etc"
      setex "a/foo.exe", true
    end
    as alice do
      rmdir "a/e"
      rm "a/f"
      lsdir "a/", { "foo.exe" => "EXEC" }
      rm "a/foo.exe"
      check_state
    end
  end
end
