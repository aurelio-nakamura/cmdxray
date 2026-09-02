// cmdxray — curated knowledge base of common commands and their flags.
// Hand-curated for accuracy and readability. Short flags are keyed by their
// single letter (so combined flags like -xzvf resolve per-letter); long flags
// are keyed with their leading "--". Extend freely; keep glosses plain-English.

export interface CommandInfo {
  summary: string;
  flags: Record<string, string>;
}

export const DB: Record<string, CommandInfo> = {
  tar: {
    summary: "archive utility — bundle files into (or extract them from) a .tar",
    flags: {
      c: "create a new archive",
      x: "extract files from an archive",
      t: "list the contents of an archive",
      z: "filter the archive through gzip (.gz)",
      j: "filter the archive through bzip2 (.bz2)",
      J: "filter the archive through xz (.xz)",
      v: "verbose — list each file as it is processed",
      f: "use the next argument as the archive file name",
      C: "change to the given directory first",
      "--create": "create a new archive",
      "--extract": "extract files from an archive",
      "--gzip": "filter the archive through gzip",
      "--verbose": "verbose — list each file as it is processed",
      "--file": "use the given archive file",
    },
  },
  grep: {
    summary: "search input for lines matching a pattern",
    flags: {
      i: "ignore case when matching",
      v: "invert — show lines that do NOT match",
      r: "search directories recursively",
      R: "search directories recursively, following symlinks",
      n: "prefix each match with its line number",
      l: "print only the names of files with matches",
      c: "print only a count of matching lines",
      E: "interpret the pattern as an extended regex",
      o: "print only the matched part of each line",
      w: "match whole words only",
      "--ignore-case": "ignore case when matching",
      "--invert-match": "show lines that do NOT match",
      "--recursive": "search directories recursively",
      "--line-number": "prefix each match with its line number",
      "--color": "highlight matches in color",
    },
  },
  ls: {
    summary: "list directory contents",
    flags: {
      l: "long format — permissions, owner, size, date",
      a: "show hidden entries (dotfiles) too",
      h: "human-readable sizes (K, M, G)",
      t: "sort by modification time, newest first",
      r: "reverse the sort order",
      S: "sort by file size, largest first",
      R: "list subdirectories recursively",
      d: "list directories themselves, not their contents",
    },
  },
  rm: {
    summary: "remove files or directories",
    flags: {
      r: "recurse into directories (delete their contents)",
      f: "force — ignore missing files, never prompt",
      i: "prompt before every removal",
      v: "verbose — explain what is being done",
      d: "remove empty directories",
    },
  },
  cp: {
    summary: "copy files or directories",
    flags: {
      r: "copy directories recursively",
      R: "copy directories recursively",
      f: "force — overwrite the destination if needed",
      i: "prompt before overwriting",
      p: "preserve mode, ownership and timestamps",
      v: "verbose — print each file as it is copied",
      a: "archive — recursive plus preserve everything",
    },
  },
  curl: {
    summary: "transfer data to or from a URL",
    flags: {
      s: "silent — hide the progress meter and errors",
      S: "with -s, still show errors",
      L: "follow HTTP redirects",
      o: "write output to the given file",
      O: "save output using the remote file name",
      X: "set the HTTP request method (e.g. POST)",
      H: "add a request header",
      d: "send the given data in a POST body",
      f: "fail silently on server errors (no error page)",
      k: "allow insecure TLS connections",
      i: "include the response headers in the output",
      u: "supply user:password credentials",
      "--silent": "hide the progress meter",
      "--location": "follow HTTP redirects",
      "--output": "write output to the given file",
      "--header": "add a request header",
      "--request": "set the HTTP request method",
      "--data": "send the given data in a POST body",
    },
  },
  find: {
    summary: "walk a directory tree looking for files",
    flags: {
      "-name": "match files by this name pattern",
      "-iname": "match by name, case-insensitively",
      "-type": "match by type (f=file, d=directory, l=symlink)",
      "-mtime": "match by modification age in days",
      "-size": "match by file size",
      "-exec": "run a command on each match",
      "-delete": "delete each matching file",
      "-maxdepth": "descend at most this many directory levels",
      "-print": "print each match (the default action)",
    },
  },
  chmod: {
    summary: "change file mode (permission) bits",
    flags: {
      R: "apply changes recursively",
      v: "verbose — report each change",
      f: "suppress error messages",
    },
  },
  ssh: {
    summary: "log in to or run a command on a remote machine",
    flags: {
      i: "use the given private key file",
      p: "connect to this port",
      L: "set up local port forwarding",
      R: "set up remote port forwarding",
      N: "do not run a remote command (forwarding only)",
      v: "verbose — print debugging output",
      t: "force a pseudo-terminal",
    },
  },
  docker: {
    summary: "build, run and manage containers",
    flags: {
      d: "detached — run in the background",
      it: "interactive with a terminal attached",
      i: "keep STDIN open (interactive)",
      t: "allocate a pseudo-terminal",
      p: "publish a container port to the host",
      v: "mount a volume (host path : container path)",
      e: "set an environment variable",
      "--rm": "remove the container when it exits",
      "--name": "give the container a name",
    },
  },
  ps: {
    summary: "report a snapshot of running processes",
    flags: {
      a: "show processes for all users",
      u: "show a user-oriented, detailed format",
      x: "include processes without a controlling terminal",
      e: "show every process",
      f: "full-format listing",
    },
  },
  kill: {
    summary: "send a signal to a process",
    flags: {
      "9": "SIGKILL — force the process to stop immediately",
      "15": "SIGTERM — politely ask the process to stop",
      l: "list the available signal names",
    },
  },
  xargs: {
    summary: "build and run command lines from standard input",
    flags: {
      n: "use at most this many arguments per command",
      I: "replace this token with each input item",
      "0": "input items are separated by NUL, not whitespace",
      P: "run this many commands in parallel",
      r: "do nothing if the input is empty",
    },
  },
};

// Generic hints for very common flags on unknown commands.
export const GENERIC_FLAGS: Record<string, string> = {
  h: "usually: show help / human-readable output",
  v: "usually: verbose output (or print the version)",
  f: "usually: force, or read from a file",
  r: "usually: recurse into directories",
  o: "usually: write output to a file",
  q: "usually: quiet — suppress normal output",
  "--help": "show usage information and exit",
  "--version": "print the version and exit",
  "--verbose": "produce more detailed output",
  "--quiet": "suppress normal output",
  "--force": "proceed without prompting",
};
