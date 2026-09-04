// src/parse.ts
var OPERATORS = /* @__PURE__ */ new Set(["&&", "||", ";", "&"]);
var REDIRECTS = /* @__PURE__ */ new Set([">", ">>", "<", "<<", "2>", "2>>", "&>", ">&", "2>&1"]);
function lex(raw) {
  const words = [];
  let cur = "";
  let quoted = false;
  let i = 0;
  const push = () => {
    if (cur.length) words.push({ text: cur, quoted });
    cur = "";
    quoted = false;
  };
  while (i < raw.length) {
    const c = raw[i];
    if (c === " " || c === "	" || c === "\n") {
      push();
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quoted = true;
      const q = c;
      i++;
      while (i < raw.length && raw[i] !== q) {
        cur += raw[i++];
      }
      i++;
      continue;
    }
    if (c === "$" && raw[i + 1] === "(") {
      let depth = 1;
      cur += "$(";
      i += 2;
      while (i < raw.length && depth > 0) {
        if (raw[i] === "(") depth++;
        else if (raw[i] === ")") depth--;
        if (depth > 0) cur += raw[i];
        i++;
      }
      cur += ")";
      continue;
    }
    cur += c;
    i++;
  }
  push();
  return words;
}
function classifyWord(word, expectCommand) {
  const { text, quoted } = word;
  if (!quoted && text === "|") return { text, kind: "pipe" };
  if (!quoted && OPERATORS.has(text)) return { text, kind: "operator" };
  if (!quoted && REDIRECTS.has(text)) return { text, kind: "redirect" };
  if (!quoted && /^\$\(.*\)$/.test(text)) return { text, kind: "subshell", quoted };
  if (expectCommand) {
    if (!quoted && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(text)) {
      return { text, kind: "assignment" };
    }
    return { text, kind: "command" };
  }
  if (!quoted && /^--[A-Za-z0-9][A-Za-z0-9-]*(=.*)?$/.test(text)) {
    return { text, kind: "longFlag" };
  }
  if (!quoted && /^-\d+$/.test(text)) {
    return { text, kind: "operand" };
  }
  if (!quoted && /^-[A-Za-z]+$/.test(text)) {
    const letters = text.slice(1).split("");
    return { text, kind: "shortFlag", bundle: letters.length > 1 ? letters : void 0 };
  }
  if (!quoted && /^-[A-Za-z]/.test(text)) {
    return { text, kind: "shortFlag" };
  }
  return { text, kind: "operand", quoted };
}
function parseCommand(raw) {
  const words = lex(raw.trim());
  const tokens = [];
  const segments = [];
  let expectCommand = true;
  let seg = { command: null, tokens: [] };
  for (const w of words) {
    const tok = classifyWord(w, expectCommand);
    tokens.push(tok);
    if (tok.kind === "pipe" || tok.kind === "operator") {
      if (seg.tokens.length) segments.push(seg);
      seg = { command: null, tokens: [] };
      expectCommand = true;
      continue;
    }
    if (tok.kind === "assignment") {
      seg.tokens.push(tok);
      continue;
    }
    if (tok.kind === "command") {
      seg.command = tok.text;
      expectCommand = false;
    }
    seg.tokens.push(tok);
  }
  if (seg.tokens.length) segments.push(seg);
  return { raw, tokens, segments };
}

// src/db.ts
var DB = {
  tar: {
    summary: "archive utility \u2014 bundle files into (or extract them from) a .tar",
    takesValue: ["f", "C"],
    bareFlags: true,
    flags: {
      c: "create a new archive",
      x: "extract files from an archive",
      t: "list the contents of an archive",
      z: "filter the archive through gzip (.gz)",
      j: "filter the archive through bzip2 (.bz2)",
      J: "filter the archive through xz (.xz)",
      v: "verbose \u2014 list each file as it is processed",
      f: "use the next argument as the archive file name",
      C: "change to the given directory first",
      "--create": "create a new archive",
      "--extract": "extract files from an archive",
      "--gzip": "filter the archive through gzip",
      "--verbose": "verbose \u2014 list each file as it is processed",
      "--file": "use the given archive file"
    }
  },
  grep: {
    summary: "search input for lines matching a pattern",
    takesValue: ["e", "f", "A", "B", "C", "m"],
    flags: {
      i: "ignore case when matching",
      v: "invert \u2014 show lines that do NOT match",
      r: "search directories recursively",
      R: "search directories recursively, following symlinks",
      n: "prefix each match with its line number",
      l: "print only the names of files with matches",
      c: "print only a count of matching lines",
      E: "interpret the pattern as an extended regex",
      F: "match fixed strings, not regexes",
      o: "print only the matched part of each line",
      w: "match whole words only",
      A: "also print N lines after each match",
      B: "also print N lines before each match",
      C: "also print N lines of context around each match",
      e: "use the next argument as the pattern",
      "--ignore-case": "ignore case when matching",
      "--invert-match": "show lines that do NOT match",
      "--recursive": "search directories recursively",
      "--line-number": "prefix each match with its line number",
      "--color": "highlight matches in color"
    }
  },
  ls: {
    summary: "list directory contents",
    flags: {
      l: "long format \u2014 permissions, owner, size, date",
      a: "show hidden entries (dotfiles) too",
      A: "show hidden entries except . and ..",
      h: "human-readable sizes (K, M, G)",
      t: "sort by modification time, newest first",
      r: "reverse the sort order",
      S: "sort by file size, largest first",
      R: "list subdirectories recursively",
      d: "list directories themselves, not their contents",
      1: "list one entry per line"
    }
  },
  rm: {
    summary: "remove files or directories",
    flags: {
      r: "recurse into directories (delete their contents)",
      f: "force \u2014 ignore missing files, never prompt",
      i: "prompt before every removal",
      v: "verbose \u2014 explain what is being done",
      d: "remove empty directories"
    }
  },
  cp: {
    summary: "copy files or directories",
    flags: {
      r: "copy directories recursively",
      R: "copy directories recursively",
      f: "force \u2014 overwrite the destination if needed",
      i: "prompt before overwriting",
      p: "preserve mode, ownership and timestamps",
      v: "verbose \u2014 print each file as it is copied",
      a: "archive \u2014 recursive plus preserve everything",
      u: "copy only when the source is newer than the destination"
    }
  },
  mv: {
    summary: "move or rename files and directories",
    flags: {
      f: "force \u2014 overwrite the destination without prompting",
      i: "prompt before overwriting",
      n: "never overwrite an existing file",
      v: "verbose \u2014 print each file as it is moved"
    }
  },
  ln: {
    summary: "make links between files",
    flags: {
      s: "make a symbolic (soft) link instead of a hard link",
      f: "force \u2014 remove an existing destination first",
      n: "treat a symlinked destination as a normal file",
      v: "verbose \u2014 print the name of each linked file",
      r: "make the symlink target relative to the link location"
    }
  },
  mkdir: {
    summary: "create directories",
    flags: {
      p: "create parent directories as needed, no error if they exist",
      v: "print a message for each created directory",
      m: "set the permission mode of the new directory"
    }
  },
  curl: {
    summary: "transfer data to or from a URL",
    takesValue: ["o", "X", "H", "d", "u", "A", "b", "c", "e"],
    flags: {
      s: "silent \u2014 hide the progress meter and errors",
      S: "with -s, still show errors",
      L: "follow HTTP redirects",
      o: "write output to the given file",
      O: "save output using the remote file name",
      X: "set the HTTP request method (e.g. POST)",
      H: "add a request header",
      d: "send the given data in a POST body",
      F: "send a multipart/form-data field",
      f: "fail silently on server errors (no error page)",
      k: "allow insecure TLS connections",
      i: "include the response headers in the output",
      I: "fetch only the response headers (HEAD request)",
      u: "supply user:password credentials",
      A: "set the User-Agent header",
      b: "send cookies (string or file)",
      "--silent": "hide the progress meter",
      "--location": "follow HTTP redirects",
      "--output": "write output to the given file",
      "--header": "add a request header",
      "--request": "set the HTTP request method",
      "--data": "send the given data in a POST body",
      "--fail": "fail silently on server errors"
    }
  },
  wget: {
    summary: "download files from the web over HTTP/FTP",
    takesValue: ["O", "P"],
    flags: {
      O: "write the download to the given file name",
      P: "save files into the given directory",
      c: "continue a partially downloaded file",
      q: "quiet \u2014 no output",
      r: "recursive \u2014 download linked pages too",
      "--no-check-certificate": "skip TLS certificate validation"
    }
  },
  find: {
    summary: "walk a directory tree looking for files",
    takesValue: [
      "-name",
      "-iname",
      "-path",
      "-ipath",
      "-type",
      "-mtime",
      "-mmin",
      "-size",
      "-maxdepth",
      "-mindepth",
      "-newer",
      "-user",
      "-group",
      "-perm"
    ],
    flags: {
      "-name": "match files by this name pattern",
      "-iname": "match by name, case-insensitively",
      "-path": "match by path pattern",
      "-ipath": "match by path pattern, case-insensitively",
      "-type": "match by type (f=file, d=directory, l=symlink)",
      "-mtime": "match by modification age in days",
      "-mmin": "match by modification age in minutes",
      "-size": "match by file size",
      "-newer": "match files newer than the given reference file",
      "-user": "match files owned by this user",
      "-group": "match files owned by this group",
      "-perm": "match files with these permission bits",
      "-empty": "match empty files and directories",
      "-exec": "run a command on each match ({} = the file, ; ends it)",
      "-execdir": "like -exec, but run from the match's own directory",
      "-ok": "like -exec, but prompt before running each command",
      "-okdir": "like -execdir, but prompt before running each command",
      "-delete": "delete each matching file",
      "-prune": "don't descend into a matching directory",
      "-maxdepth": "descend at most this many directory levels",
      "-mindepth": "ignore matches shallower than this many levels",
      "-print": "print each match (the default action)",
      "-print0": "print each match separated by NUL (for xargs -0)"
    }
  },
  ffmpeg: {
    summary: "record, convert and stream audio and video",
    flags: {
      "-i": "read from this input file (repeat for multiple inputs)",
      "-vf": "apply a video filter graph (scale, crop, fps, overlay, \u2026)",
      "-af": "apply an audio filter graph",
      "-filter_complex": "apply a filter graph across multiple inputs/outputs",
      "-c": "set the codec (use -c:v for video, -c:a for audio, copy = remux)",
      "-c:v": "set the video codec (e.g. libx264, libx265)",
      "-c:a": "set the audio codec (e.g. aac, libmp3lame)",
      "-vcodec": "set the video codec (older spelling of -c:v)",
      "-acodec": "set the audio codec (older spelling of -c:a)",
      "-b:v": "set the target video bitrate (e.g. 1M)",
      "-b:a": "set the target audio bitrate (e.g. 128k)",
      "-crf": "constant rate factor \u2014 quality vs size (lower = better, x264/x265)",
      "-preset": "encoding speed vs compression trade-off (ultrafast \u2026 veryslow)",
      "-r": "set the frame rate in frames per second",
      "-s": "set the frame size as WxH (e.g. 1280x720)",
      "-ss": "seek to this start time before processing",
      "-t": "limit the output to this duration",
      "-to": "stop writing at this timestamp",
      "-map": "choose which input streams end up in the output",
      "-f": "force this container/output format",
      "-an": "drop the audio stream (no audio)",
      "-vn": "drop the video stream (no video)",
      "-sn": "drop the subtitle stream",
      "-y": "overwrite the output file without asking",
      "-n": "never overwrite an existing output file",
      "-loglevel": "set how verbose ffmpeg's logging is",
      "-hide_banner": "suppress the startup copyright/build banner"
    },
    takesValue: [
      "-i",
      "-vf",
      "-af",
      "-filter_complex",
      "-c",
      "-c:v",
      "-c:a",
      "-vcodec",
      "-acodec",
      "-b:v",
      "-b:a",
      "-crf",
      "-preset",
      "-r",
      "-s",
      "-ss",
      "-t",
      "-to",
      "-map",
      "-f",
      "-loglevel"
    ]
  },
  openssl: {
    summary: "OpenSSL \u2014 command-line cryptography and TLS toolkit",
    subcommands: {
      req: "create or process a certificate signing request (CSR)",
      x509: "display or convert an X.509 certificate",
      genrsa: "generate an RSA private key",
      genpkey: "generate a private key (any algorithm)",
      rsa: "inspect or convert an RSA key",
      pkey: "inspect or convert a private key",
      s_client: "open a TLS connection to a server (debugging client)",
      s_server: "run a simple TLS server",
      dgst: "compute a message digest (hash) or sign/verify",
      enc: "symmetric-cipher encrypt or decrypt",
      rand: "generate random bytes",
      verify: "verify a certificate chain",
      pkcs12: "build or parse a PKCS#12 (.p12/.pfx) bundle"
    },
    flags: {
      "-x509": "output a self-signed certificate instead of a CSR",
      "-new": "generate a new request/key",
      "-newkey": "generate a new key of this type (e.g. rsa:4096)",
      "-key": "use this existing private key",
      "-keyout": "write the generated private key to this file",
      "-out": "write output to this file",
      "-in": "read input from this file",
      "-days": "how many days the certificate stays valid",
      "-nodes": "don't encrypt the private key (no passphrase)",
      "-subj": "set the subject DN inline (skip the interactive prompts)",
      "-sha256": "use SHA-256 as the signature/digest algorithm",
      "-text": "also print the certificate/key in human-readable text",
      "-noout": "don't print the encoded (PEM/DER) output",
      "-config": "use this OpenSSL configuration file",
      "-connect": "host:port to connect to (s_client)",
      "-servername": "SNI hostname to send (s_client)",
      "-passin": "source of the input passphrase",
      "-passout": "source of the output passphrase"
    },
    takesValue: [
      "-newkey",
      "-key",
      "-keyout",
      "-out",
      "-in",
      "-days",
      "-subj",
      "-config",
      "-connect",
      "-servername",
      "-passin",
      "-passout"
    ]
  },
  chmod: {
    summary: "change file mode (permission) bits",
    flags: {
      R: "apply changes recursively",
      v: "verbose \u2014 report each change",
      c: "report only files that actually change",
      f: "suppress error messages"
    }
  },
  chown: {
    summary: "change file owner and group",
    flags: {
      R: "apply changes recursively",
      v: "verbose \u2014 report each change",
      h: "affect symlinks themselves, not their targets"
    }
  },
  ssh: {
    summary: "log in to or run a command on a remote machine",
    takesValue: ["i", "p", "L", "R", "o"],
    flags: {
      i: "use the given private key file",
      p: "connect to this port",
      L: "set up local port forwarding",
      R: "set up remote port forwarding",
      D: "set up a local SOCKS proxy (dynamic forwarding)",
      N: "do not run a remote command (forwarding only)",
      f: "go to the background after authenticating",
      v: "verbose \u2014 print debugging output",
      t: "force a pseudo-terminal",
      o: "set an ssh_config option (e.g. StrictHostKeyChecking=no)"
    }
  },
  scp: {
    summary: "copy files between hosts over SSH",
    takesValue: ["i", "P"],
    flags: {
      r: "copy directories recursively",
      P: "connect to this port (capital P, unlike ssh)",
      i: "use the given private key file",
      p: "preserve modification times and modes",
      C: "compress data during transfer"
    }
  },
  rsync: {
    summary: "efficiently sync files, copying only what changed",
    takesValue: ["e"],
    flags: {
      a: "archive \u2014 recurse and preserve nearly everything",
      v: "verbose \u2014 list files as they transfer",
      z: "compress data during transfer",
      r: "recurse into directories",
      P: "show progress and keep partial files",
      n: "dry run \u2014 show what would happen, change nothing",
      u: "skip files that are newer on the destination",
      e: "use the given remote shell (e.g. ssh)",
      "--delete": "delete files on the destination that are gone from the source",
      "--exclude": "skip files matching this pattern",
      "--progress": "show a progress bar during transfer",
      "--dry-run": "show what would happen, change nothing"
    }
  },
  docker: {
    summary: "build, run and manage containers",
    takesValue: ["p", "v", "e", "--name", "--network", "-w"],
    subcommands: {
      run: "create and start a new container",
      build: "build an image from a Dockerfile",
      ps: "list running containers",
      images: "list local images",
      exec: "run a command inside a running container",
      pull: "download an image from a registry",
      push: "upload an image to a registry",
      stop: "stop a running container",
      rm: "remove a container",
      rmi: "remove an image",
      logs: "show a container's output",
      compose: "run multi-container apps from a compose file"
    },
    subFlags: {
      build: { t: "tag the built image (name:tag)" }
    },
    subTakesValue: {
      build: ["t"]
    },
    flags: {
      d: "detached \u2014 run in the background",
      it: "interactive with a terminal attached",
      i: "keep STDIN open (interactive)",
      t: "allocate a pseudo-terminal",
      p: "publish a container port to the host (host:container)",
      v: "mount a volume (host path : container path)",
      e: "set an environment variable",
      w: "set the working directory inside the container",
      "--rm": "remove the container when it exits",
      "--name": "give the container a name",
      "--network": "connect the container to this network"
    }
  },
  git: {
    summary: "the distributed version control system",
    takesValue: ["-C", "m", "b"],
    subFlags: {
      log: { n: "limit output to the last N commits" },
      shortlog: { n: "sort authors by number of commits" },
      commit: { n: "skip the pre-commit and commit-msg hooks (--no-verify)" }
    },
    subTakesValue: {
      log: ["n"]
    },
    subcommands: {
      clone: "copy a repository to your machine",
      init: "create a new empty repository here",
      add: "stage changes for the next commit",
      commit: "record staged changes as a new commit",
      status: "show what is staged, modified and untracked",
      push: "upload your commits to a remote",
      pull: "fetch from a remote and merge into the current branch",
      fetch: "download objects and refs from a remote (no merge)",
      checkout: "switch branches or restore files",
      switch: "switch to another branch",
      branch: "list, create or delete branches",
      merge: "join another branch's history into this one",
      rebase: "reapply your commits on top of another base",
      log: "show the commit history",
      diff: "show changes between commits, branches or the working tree",
      stash: "shelve uncommitted changes for later",
      reset: "move the current branch and optionally the index/working tree",
      revert: "make a new commit that undoes an earlier one",
      tag: "create, list or delete tags",
      remote: "manage the set of tracked repositories",
      cherry: "apply the change introduced by a specific commit",
      restore: "restore working-tree files"
    },
    flags: {
      m: "use the next argument as the commit message",
      a: "automatically stage every tracked, modified file",
      b: "create and switch to a new branch",
      f: "force the operation",
      d: "delete (e.g. a branch)",
      D: "force-delete (e.g. an unmerged branch)",
      n: "dry run / no-commit, depending on the subcommand",
      "--amend": "replace the previous commit instead of adding a new one",
      "--force": "force the operation (e.g. push)",
      "--all": "operate on everything (all branches / all changes)",
      "--oneline": "show each commit on a single line",
      "--graph": "draw an ASCII graph of the branch structure",
      "-C": "run as if git was started in the given directory"
    }
  },
  npm: {
    summary: "the Node.js package manager",
    subcommands: {
      install: "install dependencies (or a named package)",
      i: "install dependencies (short for install)",
      run: "run a script defined in package.json",
      test: "run the project's test script",
      start: "run the project's start script",
      publish: "publish the package to the registry",
      init: "create a package.json",
      update: "update packages to newer allowed versions",
      uninstall: "remove a package",
      ci: "clean install exactly from the lockfile",
      exec: "run a package's binary"
    },
    flags: {
      g: "operate globally, not on the local project",
      D: "save to devDependencies",
      "--save-dev": "save to devDependencies",
      "--global": "operate globally",
      "--production": "skip devDependencies"
    }
  },
  systemctl: {
    summary: "control the systemd init system and its services",
    subcommands: {
      start: "start a service now",
      stop: "stop a running service now",
      restart: "stop and start a service",
      reload: "tell a service to reload its configuration",
      status: "show whether a service is running, plus recent logs",
      enable: "start this service automatically at boot",
      disable: "do not start this service at boot",
      "daemon-reload": "reload systemd's own unit files after edits",
      list: "list units",
      "is-active": "check whether a unit is currently running"
    },
    flags: {
      "--now": "also start/stop immediately (with enable/disable)",
      "--user": "act on the per-user systemd, not the system one",
      "--failed": "limit output to failed units"
    }
  },
  kubectl: {
    summary: "control a Kubernetes cluster",
    takesValue: ["n", "-n", "o", "-o", "f", "-f", "l", "-l"],
    subcommands: {
      get: "list resources of a given type",
      describe: "show detailed state of a resource",
      apply: "create or update resources from a file",
      delete: "remove resources",
      logs: "print a pod's logs",
      exec: "run a command inside a pod",
      create: "create a resource",
      edit: "edit a live resource in your editor",
      scale: "change the number of replicas",
      rollout: "manage a rollout (status, undo, restart)",
      port: "forward a local port to a pod (port-forward)"
    },
    subFlags: {
      logs: { f: "follow \u2014 stream new log lines as they arrive" },
      "port-forward": { f: "read the resource definition from this file" }
    },
    subTakesValue: {
      logs: []
    },
    flags: {
      n: "act in the given namespace",
      o: "choose the output format (json, yaml, wide)",
      f: "read the resource definition from this file",
      l: "select resources by label",
      w: "watch for changes and stream updates",
      A: "act across all namespaces",
      "--all-namespaces": "act across all namespaces",
      "--namespace": "act in the given namespace"
    }
  },
  apt: {
    summary: "install and manage Debian/Ubuntu packages",
    subcommands: {
      install: "install one or more packages",
      remove: "remove packages but keep their config",
      purge: "remove packages and their config",
      update: "refresh the list of available packages",
      upgrade: "install newer versions of installed packages",
      search: "search for packages by keyword",
      show: "show details about a package",
      list: "list packages (installed, upgradable, \u2026)",
      autoremove: "remove packages no longer needed"
    },
    flags: {
      y: "assume yes \u2014 do not prompt for confirmation",
      "--yes": "assume yes \u2014 do not prompt for confirmation",
      "--no-install-recommends": "do not install recommended extras"
    }
  },
  sed: {
    summary: "stream editor \u2014 transform text line by line",
    takesValue: ["e", "f"],
    flags: {
      i: "edit files in place instead of printing to stdout",
      n: "suppress automatic printing (use with p)",
      e: "add the next argument as an editing script",
      E: "use extended regular expressions",
      r: "use extended regular expressions (GNU)",
      "--in-place": "edit files in place"
    }
  },
  awk: {
    summary: "pattern-scanning and text-processing language",
    takesValue: ["F", "v", "f"],
    flags: {
      F: "set the input field separator",
      v: "assign a variable before the program runs",
      f: "read the awk program from a file"
    }
  },
  jq: {
    summary: "command-line JSON processor (apply a filter to JSON input)",
    takesValue: ["arg", "argjson", "f", "slurpfile", "rawfile"],
    flags: {
      r: "raw output \u2014 print strings without JSON quotes",
      j: "raw output with no trailing newline between results",
      c: "compact output \u2014 one JSON result per line",
      n: "don't read input; use null as the input",
      s: "slurp \u2014 read the whole input stream into one array",
      R: "read raw input \u2014 each line becomes a JSON string",
      e: "set the exit code from the last output (for scripting)",
      S: "sort object keys in the output",
      a: "output non-ASCII characters as \\uXXXX escapes",
      f: "read the filter program from a file",
      arg: "define a string variable: --arg name value",
      argjson: "define a JSON variable: --argjson name json",
      tab: "indent the output with tabs"
    }
  },
  ps: {
    summary: "report a snapshot of running processes",
    bareFlags: true,
    flags: {
      a: "show processes for all users",
      u: "show a user-oriented, detailed format",
      x: "include processes without a controlling terminal",
      e: "show every process",
      f: "full-format listing"
    }
  },
  netstat: {
    summary: "show network connections, routing tables, and interface stats",
    flags: {
      t: "TCP connections",
      u: "UDP connections",
      l: "only listening sockets",
      p: "show the PID and program name for each socket",
      n: "numeric output \u2014 don't resolve hosts, ports, or users",
      a: "all sockets (listening and non-listening)",
      r: "show the kernel routing table",
      e: "extended information",
      s: "per-protocol summary statistics",
      c: "continuously refresh the display"
    }
  },
  ss: {
    summary: "inspect sockets (a faster, modern replacement for netstat)",
    flags: {
      t: "TCP sockets",
      u: "UDP sockets",
      l: "only listening sockets",
      p: "show the process using each socket",
      n: "numeric output \u2014 don't resolve service names",
      a: "all sockets (listening and non-listening)",
      s: "print summary statistics"
    }
  },
  kill: {
    summary: "send a signal to a process",
    flags: {
      "9": "SIGKILL \u2014 force the process to stop immediately",
      "15": "SIGTERM \u2014 politely ask the process to stop",
      l: "list the available signal names",
      s: "send the named signal"
    }
  },
  xargs: {
    summary: "build and run command lines from standard input",
    takesValue: ["n", "I", "P", "d"],
    flags: {
      n: "use at most this many arguments per command",
      I: "replace this token with each input item",
      "0": "input items are separated by NUL, not whitespace",
      P: "run this many commands in parallel",
      r: "do nothing if the input is empty",
      t: "print each command before running it"
    }
  },
  head: {
    summary: "print the first part of files",
    takesValue: ["n", "c"],
    flags: {
      n: "print the first N lines",
      c: "print the first N bytes"
    }
  },
  tail: {
    summary: "print the last part of files",
    takesValue: ["n", "c"],
    flags: {
      n: "print the last N lines",
      c: "print the last N bytes",
      f: "follow \u2014 keep printing new lines as the file grows",
      F: "follow by name, retrying if the file is rotated"
    }
  },
  sort: {
    summary: "sort lines of text",
    takesValue: ["k", "t"],
    flags: {
      n: "sort numerically, not alphabetically",
      r: "reverse the result order",
      u: "output only the first of equal lines (unique)",
      h: "sort human-readable sizes (2K, 1G)",
      k: "sort by the given field/key",
      t: "use the given field separator",
      f: "fold case \u2014 treat lower and upper case alike"
    }
  },
  cut: {
    summary: "extract selected columns from each line",
    takesValue: ["d", "f", "c"],
    flags: {
      d: "use the given delimiter between fields",
      f: "select these fields",
      c: "select these character positions"
    }
  },
  tr: {
    summary: "translate or delete characters",
    flags: {
      d: "delete the given characters",
      s: "squeeze repeats of the given characters into one",
      c: "use the complement of the given set"
    }
  },
  wc: {
    summary: "count lines, words and bytes",
    flags: {
      l: "count lines",
      w: "count words",
      c: "count bytes",
      m: "count characters"
    }
  },
  cat: {
    summary: "concatenate files and print them",
    flags: {
      n: "number every output line",
      A: "show non-printing characters, tabs and line ends",
      b: "number non-blank output lines"
    }
  },
  du: {
    summary: "estimate file and directory disk usage",
    takesValue: ["-max-depth"],
    flags: {
      h: "human-readable sizes (K, M, G)",
      s: "show only a total for each argument",
      a: "show sizes for files too, not just directories",
      c: "also print a grand total",
      "-max-depth": "only report directories this many levels deep"
    }
  },
  df: {
    summary: "report free space on mounted filesystems",
    flags: {
      h: "human-readable sizes (K, M, G)",
      T: "also show each filesystem's type",
      i: "report inode usage instead of block usage"
    }
  },
  ping: {
    summary: "test reachability of a host on the network",
    takesValue: ["c", "i", "W"],
    flags: {
      c: "stop after sending this many packets",
      i: "wait this many seconds between packets",
      W: "time to wait for a reply, in seconds"
    }
  },
  dd: {
    summary: "copy and convert data block by block",
    flags: {
      "if": "read from this input file",
      of: "write to this output file",
      bs: "read and write this many bytes at a time",
      count: "copy only this many blocks",
      status: "control how progress is reported"
    }
  },
  make: {
    summary: "build targets according to a Makefile",
    takesValue: ["j", "f", "C"],
    flags: {
      j: "run this many recipe jobs in parallel",
      f: "use the given file instead of Makefile",
      C: "change to this directory first",
      B: "unconditionally rebuild every target",
      n: "dry run \u2014 print recipes without running them"
    }
  }
};
var GENERIC_FLAGS = {
  h: "usually: show help / human-readable output",
  v: "usually: verbose output (or print the version)",
  f: "usually: force, or read from a file",
  r: "usually: recurse into directories",
  o: "usually: write output to a file",
  q: "usually: quiet \u2014 suppress normal output",
  y: "usually: assume yes to prompts",
  n: "usually: dry run, or a count",
  "--help": "show usage information and exit",
  "--version": "print the version and exit",
  "--verbose": "produce more detailed output",
  "--quiet": "suppress normal output",
  "--force": "proceed without prompting",
  "--yes": "assume yes to prompts",
  "--dry-run": "show what would happen without doing it"
};
var EXAMPLES = {
  tar: ["tar -xzvf archive.tar.gz", "tar czf backup.tgz src"],
  grep: ["grep -rn TODO src", "grep -i --color needle file.txt"],
  ls: ["ls -la", "ls -lhSr"],
  rm: ["rm -rf build", "rm -i note.txt"],
  cp: ["cp -r src dest", "cp -p a.txt b.txt"],
  mv: ["mv -i old new", "mv -v a b"],
  mkdir: ["mkdir -p a/b/c", "mkdir -m 755 dir"],
  ln: ["ln -s /usr/bin/python3 python", "ln -sf target link"],
  curl: ["curl -sSL -o out.html https://example.com", "curl -X POST -H 'A: b' -d data url"],
  wget: ["wget -c -O file.zip https://example.com/f.zip"],
  find: ["find . -name '*.log' -mtime +30 -delete", "find src -type f -maxdepth 2"],
  ffmpeg: ["ffmpeg -i in.mov -c:v libx264 -crf 23 -preset medium out.mp4", "ffmpeg -i in.mp4 -vf scale=1280:-1 -an out.webm"],
  openssl: ["openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes", "openssl s_client -connect example.com:443 -servername example.com"],
  chmod: ["chmod -R 755 dir", "chmod -v 600 key"],
  chown: ["chown -R user:group dir"],
  ssh: ["ssh -i key.pem -p 2222 user@host", "ssh -N -L 8080:localhost:80 host"],
  scp: ["scp -r -P 22 file user@host:/tmp"],
  rsync: ["rsync -avz --delete src/ dest/", "rsync -a --dry-run a/ b/"],
  docker: ["docker run -it --rm -p 8080:80 nginx", "docker build -t myimg ."],
  git: ["git commit -am 'fix bug'", "git checkout -b feature", "git log --oneline --graph"],
  npm: ["npm install -D typescript", "npm run build"],
  systemctl: ["systemctl restart nginx", "systemctl enable --now docker"],
  kubectl: ["kubectl get pods -n default -o wide", "kubectl logs -f mypod"],
  apt: ["apt install -y curl", "apt upgrade --yes"],
  sed: ["sed -i 's/a/b/g' file.txt", "sed -n -e '1,10p' file.txt"],
  awk: ["awk -F, '{print $1}' data.csv"],
  jq: ["jq -r '.items[] | select(.age > 30) | .name' data.json"],
  ps: ["ps aux", "ps -ef"],
  netstat: ["netstat -tulpn", "netstat -rn"],
  ss: ["ss -tulpn", "ss -s"],
  kill: ["kill -9 1234", "kill -15 4321"],
  xargs: ["xargs -0 -I{} rm {}", "xargs -n1 -P4 echo"],
  head: ["head -n 20 file.txt", "head -c 100 file.bin"],
  tail: ["tail -f -n 100 log.txt"],
  sort: ["sort -k2 -n -r data.txt", "sort -u -f names.txt"],
  cut: ["cut -d, -f1 data.csv", "cut -c1-10 file.txt"],
  tr: ["tr -d '\\n'", "tr -s ' '"],
  wc: ["wc -l file.txt", "wc -w -c file.txt"],
  cat: ["cat -n file.txt", "cat -A file.txt"],
  du: ["du -sh dir", "du -ah ."],
  df: ["df -h", "df -T -i"],
  ping: ["ping -c 4 host", "ping -i 2 host"],
  dd: ["dd if=/dev/zero of=out.img bs=1M count=10"],
  make: ["make -j4 -C build", "make -f Makefile.dev -n"]
};

// src/scripts.ts
function sedGloss(tok) {
  let s = tok;
  let addr = "";
  const addrMatch = s.match(/^(\$|\d+(,\d+)?|\/(?:\\.|[^/])*\/|\d+~\d+)(!?)/);
  if (addrMatch && /[a-z=]/i.test(s.slice(addrMatch[0].length))) {
    addr = addrMatch[0];
    s = s.slice(addr.length);
  }
  const addrText = addr ? ` (on ${addr.endsWith("!") ? "lines NOT matching " + addr.slice(0, -1) : "line/range " + addr})` : "";
  if (/^s(.)/.test(s)) {
    const delim = s[1];
    const parts = splitOnDelim(s.slice(2), delim);
    if (parts.length >= 2) {
      const [pat, rep, flags = ""] = parts;
      const fl = [];
      if (flags.includes("g")) fl.push("every match on the line, not just the first");
      if (/i/i.test(flags)) fl.push("case-insensitive");
      if (flags.includes("p")) fl.push("print the changed line");
      const nMatch = flags.match(/\d+/);
      if (nMatch) fl.push(`only the ${ordinal(+nMatch[0])} match`);
      const flTxt = fl.length ? ` \u2014 ${fl.join(", ")}` : "";
      return `substitute: replace "${pat}" with "${rep}"${flTxt}${addrText}`;
    }
  }
  if (/^y(.)/.test(s)) {
    const delim = s[1];
    const parts = splitOnDelim(s.slice(2), delim);
    if (parts.length >= 2) {
      return `transliterate: map each character in "${parts[0]}" to the matching one in "${parts[1]}"${addrText}`;
    }
  }
  const oneLetter = {
    d: "delete the matching line(s)",
    p: "print the matching line(s)",
    D: "delete up to the first newline of the pattern space",
    P: "print up to the first newline of the pattern space",
    n: "print current line, then load the next",
    N: "append the next line to the pattern space",
    q: "quit after this line",
    "=": "print the current line number"
  };
  if (s.length === 1 && oneLetter[s]) return `${oneLetter[s]}${addrText}`;
  if (/^\d+d$/.test(s)) return `delete line ${s.slice(0, -1)}`;
  return null;
}
function awkGloss(tok) {
  if (!/[{}]/.test(tok) && !/^\/.*\/$/.test(tok)) return null;
  const bits = [];
  if (/^\s*\{?\s*print\s*\$0?\s*\}?\s*$/.test(tok)) {
    bits.push("print each whole line");
  } else {
    const cols = [...tok.matchAll(/\$(\d+)/g)].map((m) => +m[1]);
    if (cols.length) {
      const uniq = [...new Set(cols)].sort((a, b) => a - b);
      bits.push(
        `use column${uniq.length > 1 ? "s" : ""} ${uniq.map((c) => c === 0 ? "whole line" : "$" + c).join(", ")}`
      );
    }
  }
  if (/\bNR\b/.test(tok)) bits.push("NR = current line number");
  if (/\bNF\b/.test(tok)) bits.push("NF = number of fields on the line");
  const patMatch = tok.match(/^\/((?:\\.|[^/])*)\//);
  if (patMatch) bits.push(`only on lines matching /${patMatch[1]}/`);
  const detail = bits.length ? ` \u2014 ${bits.join("; ")}` : "";
  return `awk program: run this on each input line${detail}`;
}
function splitOnDelim(s, delim) {
  const out = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) {
      cur += s[i] + s[i + 1];
      i++;
      continue;
    }
    if (s[i] === delim) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += s[i];
  }
  out.push(cur);
  return out;
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function jqGloss(tok) {
  const t = tok.trim();
  if (!t) return null;
  const looksJq = /^[.\[{(]/.test(t) || /^(keys|length|add|type|values|to_entries|from_entries|map|select|sort|sort_by|group_by|unique|flatten|first|last|min|max|has|any|all|reverse|floor|ceil|ascii_downcase|ascii_upcase|split|join|test|ltrimstr|rtrimstr|tostring|tonumber|empty|range|env|now|paths|getpath|recurse|del)\b/.test(
    t
  ) || splitTopPipes(t).length > 1;
  if (!looksJq) return null;
  const stages = splitTopPipes(t).map((s) => s.trim()).filter(Boolean);
  const parts = stages.map(jqStage);
  if (parts.every((p) => p === null)) return null;
  const desc = parts.map((p, i) => p || `apply \`${stages[i]}\``).join(", then ");
  return `jq filter: ${desc}`;
}
function jqStage(s) {
  if (s === "." || s === "") return "keep the whole input";
  if (s === ".[]") return "iterate over each element/value";
  if (s === "keys") return "list its keys";
  if (s === "length") return "get its length/count";
  if (s === "add") return "sum/concatenate the elements";
  if (s === "unique") return "drop duplicate values";
  if (s === "reverse") return "reverse the order";
  if (s === "flatten") return "flatten nested arrays";
  if (s === "first" || s === "last") return `take the ${s} element`;
  if (s === "to_entries") return "convert the object to {key,value} pairs";
  if (s === "from_entries") return "rebuild an object from {key,value} pairs";
  if (s === "type") return "report the JSON type";
  if (s === "values") return "keep only non-null values";
  const field = s.match(/^\.([A-Za-z_][\w]*)((?:\.[A-Za-z_][\w]*|\[\d*\]|\["[^"]*"\])*)(\??)$/);
  if (field) {
    const path = "." + field[1] + field[2];
    if (/\[\]$/.test(path)) return `iterate over each element of ${path.replace(/\[\]$/, "")}`;
    const idx = path.match(/\[(\d+)\]$/);
    if (idx) return `take index ${idx[1]} of ${path.replace(/\[\d+\]$/, "")}`;
    return `get field ${path}`;
  }
  const call = s.match(/^([a-z_]+)\s*\((.*)\)$/s);
  if (call) {
    const [, fn, arg] = call;
    const a = arg.trim();
    switch (fn) {
      case "select":
        return `keep only items where ${a}`;
      case "map":
        return `apply \`${a}\` to each element`;
      case "map_values":
        return `apply \`${a}\` to each value`;
      case "sort_by":
        return `sort by ${a}`;
      case "group_by":
        return `group by ${a}`;
      case "has":
        return `check it has key ${a}`;
      case "split":
        return `split the string on ${a}`;
      case "join":
        return `join the array with ${a}`;
      case "test":
        return `test whether it matches ${a}`;
      case "recurse":
        return `recurse into ${a || "all children"}`;
      case "del":
        return `delete ${a}`;
    }
    return `run ${fn}(${a})`;
  }
  if (/^\{[\s\S]*\}$/.test(s)) return "build an object from the given fields";
  if (/^\[[\s\S]*\]$/.test(s)) return "collect the results into an array";
  if (/^@(csv|tsv|json|base64|base64d|sh|html|uri|text)$/.test(s))
    return `format the output as ${s.slice(1).toUpperCase()}`;
  if (/^sort$/.test(s)) return "sort the array";
  return null;
}
function splitTopPipes(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  let quote = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === "\\" && i + 1 < s.length) {
        cur += s[++i];
      } else if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "|" && depth === 0 && s[i + 1] !== "=" && s[i - 1] !== "|") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}
function chmodModeGloss(tok) {
  if (/^[0-7]{3,4}$/.test(tok)) {
    const special = tok.length === 4 ? tok[0] : "";
    const digits = tok.length === 4 ? tok.slice(1) : tok;
    const who = ["owner", "group", "other"];
    const parts = digits.split("").map((d, i) => {
      const n = +d;
      return `${who[i]} ${(n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-")}`;
    });
    const sym = digits.split("").map((d) => {
      const n = +d;
      return (n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-");
    }).join("");
    let extra = "";
    if (special) {
      const s = +special;
      const bits = [];
      if (s & 4) bits.push("setuid");
      if (s & 2) bits.push("setgid");
      if (s & 1) bits.push("sticky bit");
      if (bits.length) extra = ` + ${bits.join(", ")}`;
    }
    return `permissions ${sym}${extra} \u2014 ${parts.join(", ")}`;
  }
  if (/^([ugoa]*[+\-=][rwxXst]*)(,[ugoa]*[+\-=][rwxXst]*)*$/.test(tok) && /[+\-=]/.test(tok)) {
    const whoMap = { u: "owner", g: "group", o: "others", a: "all" };
    const permMap = {
      r: "read",
      w: "write",
      x: "execute",
      X: "execute (dirs or already-executable)",
      s: "setuid/setgid",
      t: "sticky bit"
    };
    const opMap = { "+": "add", "-": "remove", "=": "set exactly" };
    const clauses = tok.split(",").map((cl) => {
      const m = cl.match(/^([ugoa]*)([+\-=])([rwxXst]*)$/);
      if (!m) return cl;
      const who = (m[1] || "a").split("").map((c) => whoMap[c]).join("/");
      const op = opMap[m[2]];
      const perms = m[3].split("").map((c) => permMap[c] || c).join(" + ") || "(no permissions)";
      return `${op} ${perms} for ${who}`;
    });
    return `permission change: ${clauses.join("; ")}`;
  }
  return null;
}
var KILL_SIGNALS = {
  HUP: [1, "hang up \u2014 commonly triggers a config reload"],
  INT: [2, "interrupt, like pressing Ctrl-C"],
  QUIT: [3, "quit and dump core"],
  ABRT: [6, "abort"],
  KILL: [9, "force kill \u2014 cannot be caught, blocked, or ignored"],
  USR1: [10, "user-defined signal 1"],
  USR2: [12, "user-defined signal 2"],
  PIPE: [13, "broken pipe"],
  ALRM: [14, "timer alarm"],
  TERM: [15, "polite request to terminate (the default signal)"],
  CONT: [18, "resume a stopped process"],
  STOP: [19, "stop (pause) the process \u2014 cannot be caught"],
  TSTP: [20, "stop from the terminal, like Ctrl-Z"]
};
var SIGNAL_BY_NUM = Object.fromEntries(
  Object.entries(KILL_SIGNALS).map(([name, [n]]) => [n, name])
);
function killSignalGloss(tok) {
  let s = tok.replace(/^-/, "");
  if (s === "") return null;
  s = s.replace(/^SIG/i, "").toUpperCase();
  if (/^\d+$/.test(s)) {
    const n = +s;
    const name = SIGNAL_BY_NUM[n];
    if (name) return `send signal ${n} (SIG${name}) \u2014 ${KILL_SIGNALS[name][1]}`;
    return `send signal ${n} to the process`;
  }
  if (s in KILL_SIGNALS) {
    const [n, desc] = KILL_SIGNALS[s];
    return `send SIG${s} (signal ${n}) \u2014 ${desc}`;
  }
  return null;
}

// src/explain.ts
var OPERATOR_GLOSS = {
  "|": "pipe \u2014 send this command's output into the next command",
  "&&": "and-then \u2014 run the next command only if this one succeeds",
  "||": "or-else \u2014 run the next command only if this one fails",
  ";": "then \u2014 run the next command regardless of the previous result",
  "&": "run the preceding command in the background",
  ">": "redirect output into the given file (overwrite)",
  ">>": "redirect output onto the end of the given file (append)",
  "<": "read input from the given file",
  "2>": "redirect error output into the given file",
  "2>>": "append error output to the given file",
  "&>": "redirect both normal and error output into the given file",
  "2>&1": "send error output to the same place as normal output"
};
function explain(raw, opts = {}) {
  const parsed = parseCommand(raw);
  const lines = [];
  let color = 0;
  let info = null;
  let cmdName = null;
  let expectCommand = true;
  let sawSubcommand = false;
  let currentSub = null;
  let operandCount = 0;
  let pendingValueFor = null;
  let nestedArmed = false;
  let inNested = false;
  const EXEC_FLAGS = /* @__PURE__ */ new Set(["-exec", "-execdir", "-ok", "-okdir"]);
  const enterNested = (word, ti, verb) => {
    info = DB[word] ?? opts.manLookup?.(word) ?? null;
    cmdName = word;
    add(
      word,
      info ? `${verb}: ${info.summary}` : `${verb} the "${word}" command`,
      ti,
      info ? DB[word] ? "db" : "man" : "structure"
    );
    nestedArmed = false;
    inNested = true;
    sawSubcommand = false;
    currentSub = null;
    operandCount = 0;
    pendingValueFor = null;
  };
  const add = (token, gloss, ti, source) => {
    lines.push({ token, gloss, colorIndex: color++, tokenIndex: ti, source });
  };
  const flagGloss = (info2, key) => {
    if (currentSub) {
      const sf = info2?.subFlags?.[currentSub];
      if (sf && key in sf) return sf[key];
    }
    return info2?.flags[key];
  };
  const takesValue = (info2, key) => {
    if (currentSub) {
      const sf = info2?.subFlags?.[currentSub];
      if (sf && key in sf) return !!info2?.subTakesValue?.[currentSub]?.includes(key);
    }
    return !!info2?.takesValue?.includes(key);
  };
  parsed.tokens.forEach((tok, ti) => {
    switch (tok.kind) {
      case "pipe":
      case "operator":
        add(tok.text, OPERATOR_GLOSS[tok.text] ?? "shell control operator", ti, "structure");
        info = null;
        cmdName = null;
        expectCommand = true;
        sawSubcommand = false;
        currentSub = null;
        operandCount = 0;
        pendingValueFor = null;
        nestedArmed = false;
        inNested = false;
        break;
      case "redirect":
        add(tok.text, OPERATOR_GLOSS[tok.text] ?? "shell redirection", ti, "structure");
        break;
      case "assignment": {
        const [name] = tok.text.split("=");
        add(tok.text, `set the environment variable ${name} for this command`, ti, "structure");
        break;
      }
      case "command":
        info = DB[tok.text] ?? opts.manLookup?.(tok.text) ?? null;
        cmdName = tok.text;
        add(
          tok.text,
          info ? info.summary : `run the "${tok.text}" program`,
          ti,
          info ? DB[tok.text] ? "db" : "man" : "structure"
        );
        expectCommand = false;
        sawSubcommand = false;
        currentSub = null;
        operandCount = 0;
        nestedArmed = tok.text === "xargs";
        inNested = false;
        break;
      case "subshell":
        add(tok.text, "run this inner command first and substitute its output", ti, "structure");
        break;
      case "longFlag": {
        const key = tok.text.split("=")[0];
        const hasInlineValue = tok.text.includes("=");
        const dbGloss = flagGloss(info, key);
        const gloss = dbGloss ?? GENERIC_FLAGS[key] ?? "a command option";
        add(tok.text, gloss, ti, dbGloss ? "db" : GENERIC_FLAGS[key] ? "generic" : "structure");
        if (!hasInlineValue && takesValue(info, key)) pendingValueFor = tok.text;
        break;
      }
      case "shortFlag": {
        if (cmdName === "kill" || cmdName === "killall" || cmdName === "pkill") {
          const sig = killSignalGloss(tok.text);
          if (sig) {
            add(tok.text, sig, ti, "db");
            break;
          }
        }
        const whole = flagGloss(info, tok.text);
        if (whole) {
          add(tok.text, whole, ti, "db");
          if (cmdName === "find" && EXEC_FLAGS.has(tok.text)) nestedArmed = true;
          else if (takesValue(info, tok.text)) pendingValueFor = tok.text;
          break;
        }
        const body = tok.text.replace(/^-/, "");
        const letters = body.split("");
        const known = (l) => flagGloss(info, l) ?? GENERIC_FLAGS[l];
        if (letters.length > 1 && letters.every((l) => known(l) !== void 0)) {
          for (const l of letters) {
            add("-" + l, known(l), ti, flagGloss(info, l) ? "db" : "generic");
          }
          const last = letters[letters.length - 1];
          if (takesValue(info, last)) pendingValueFor = "-" + last;
          break;
        }
        const first = body.slice(0, 1);
        const gloss = known(first) ?? "a command option";
        add(tok.text, gloss, ti, flagGloss(info, first) ? "db" : GENERIC_FLAGS[first] ? "generic" : "structure");
        if (body.length === 1 && takesValue(info, first)) pendingValueFor = tok.text;
        break;
      }
      case "operand": {
        if (pendingValueFor) {
          add(tok.text, `value for ${pendingValueFor}`, ti, "structure");
          pendingValueFor = null;
          operandCount++;
          break;
        }
        if (inNested || nestedArmed) {
          if (tok.text === "{}") {
            add(tok.text, "placeholder \u2014 each matched item is substituted here", ti, "db");
            operandCount++;
            break;
          }
          if (tok.text === "\\;" || tok.text === ";") {
            add(tok.text, "end of the -exec command (one run per match)", ti, "structure");
            inNested = false;
            break;
          }
          if (tok.text === "+") {
            add(tok.text, "end of -exec: run once with all matches appended", ti, "structure");
            inNested = false;
            break;
          }
        }
        if (nestedArmed && !tok.text.startsWith("-")) {
          enterNested(tok.text, ti, cmdName === "xargs" ? "run per input item" : "run on each match");
          break;
        }
        if (tok.text.startsWith("-")) {
          const stripped = tok.text.replace(/^-+/, "");
          const g = flagGloss(info, stripped);
          if (g) {
            add(tok.text, g, ti, "db");
            if (takesValue(info, stripped)) pendingValueFor = tok.text;
            operandCount++;
            break;
          }
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok.text)) {
          const name = tok.text.split("=")[0];
          add(tok.text, `set ${name} for this command`, ti, "structure");
          operandCount++;
          break;
        }
        if (info?.subcommands && !sawSubcommand && info.subcommands[tok.text]) {
          add(tok.text, info.subcommands[tok.text], ti, "db");
          sawSubcommand = true;
          currentSub = tok.text;
          break;
        }
        if (info?.bareFlags && operandCount === 0 && !sawSubcommand && /^[A-Za-z]{2,}$/.test(tok.text) && tok.text.split("").every((l) => info.flags[l] !== void 0)) {
          const letters = tok.text.split("");
          for (const l of letters) add(l, info.flags[l], ti, "db");
          const last = letters[letters.length - 1];
          if (takesValue(info, last)) pendingValueFor = last;
          operandCount++;
          break;
        }
        if (cmdName === "sed") {
          const g = sedGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        if (cmdName === "awk") {
          const g = awkGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        if (cmdName === "jq") {
          const g = jqGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        if (cmdName === "chmod" && operandCount === 0) {
          const g = chmodModeGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        if (cmdName === "kill" || cmdName === "killall" || cmdName === "pkill") {
          const sig = killSignalGloss(tok.text);
          if (sig) {
            add(tok.text, sig, ti, "db");
            operandCount++;
            break;
          }
          if (cmdName === "kill" && /^%?\d+$/.test(tok.text)) {
            add(
              tok.text,
              tok.text.startsWith("%") ? `job ${tok.text} to signal` : "process ID (PID) to signal",
              ti,
              "structure"
            );
            operandCount++;
            break;
          }
        }
        if (info?.flags[tok.text]) {
          add(tok.text, info.flags[tok.text], ti, "db");
        } else if (/^-\d+$/.test(tok.text)) {
          add(tok.text, "a numeric option (often a count or limit)", ti, "structure");
        } else {
          add(tok.text, "an argument passed to the command", ti, "structure");
        }
        operandCount++;
        break;
      }
    }
  });
  return { raw, parsed, lines };
}

// src/card.ts
var COLORS = ["#79c0ff", "#7ee787", "#ffa657", "#d2a8ff", "#ff7b72", "#f2cc60", "#56d4dd", "#ff9bce"];
var BG = "#0d1117";
var PANEL = "#161b22";
var BORDER = "#30363d";
var FG = "#e6edf3";
var MUTED = "#8b949e";
var FONT = "ui-monospace,'SF Mono','JetBrains Mono','Fira Code',Menlo,Consolas,monospace";
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function colorByTokenIndex(res) {
  const map = /* @__PURE__ */ new Map();
  for (const ln of res.lines) {
    if (!map.has(ln.tokenIndex)) map.set(ln.tokenIndex, ln.colorIndex);
  }
  return map;
}
function renderSvg(res, opts = {}) {
  const brand = opts.brand ?? "cmdxray";
  const CHARW = 15.5;
  const PADX = 34;
  const cmdColors = colorByTokenIndex(res);
  let cx = PADX + 18;
  const cmdParts = [];
  const structural = /* @__PURE__ */ new Set(["pipe", "operator", "redirect"]);
  res.parsed.tokens.forEach((tok, ti) => {
    const isStruct = structural.has(tok.kind);
    const ci = cmdColors.get(ti) ?? 0;
    const col = isStruct ? MUTED : COLORS[ci % COLORS.length];
    const weight = tok.kind === "command" ? "700" : "600";
    cmdParts.push(
      `<text x="${cx}" y="72" fill="${col}" font-size="26" font-family="${FONT}" font-weight="${weight}">${esc(tok.text)}</text>`
    );
    cx += CHARW * tok.text.length + CHARW;
  });
  const rowH = 44;
  const glossTop = 150;
  const rows = res.lines.map((ln, i) => {
    const y = glossTop + i * rowH;
    const col = COLORS[ln.colorIndex % COLORS.length];
    return `<circle cx="${PADX + 8}" cy="${y - 6}" r="6" fill="${col}"/><text x="${PADX + 26}" y="${y}" fill="${col}" font-size="19" font-family="${FONT}" font-weight="600">${esc(ln.token)}</text><text x="${PADX + 220}" y="${y}" fill="${FG}" font-size="18" font-family="${FONT}">${esc(ln.gloss)}</text>`;
  }).join("");
  const width = Math.max(760, estimateWidth(res));
  const height = glossTop + res.lines.length * rowH + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
  <rect width="${width}" height="${height}" rx="16" fill="${BG}"/>
  <rect x="16" y="16" width="${width - 32}" height="84" rx="10" fill="${PANEL}" stroke="${BORDER}"/>
  <circle cx="40" cy="42" r="6" fill="#ff5f56"/><circle cx="60" cy="42" r="6" fill="#ffbd2e"/><circle cx="80" cy="42" r="6" fill="#27c93f"/>
  <text x="${width - 28}" y="46" text-anchor="end" fill="${MUTED}" font-size="14">offline</text>
  ${cmdParts.join("")}
  <line x1="${PADX}" y1="${glossTop - 26}" x2="${width - PADX}" y2="${glossTop - 26}" stroke="${BORDER}"/>
  ${rows}
  <text x="${PADX}" y="${height - 16}" fill="${MUTED}" font-size="14">explained locally \xB7 <tspan fill="${FG}">${esc(brand)}</tspan></text>
</svg>`;
}
function estimateWidth(res) {
  let maxGloss = 0;
  for (const ln of res.lines) maxGloss = Math.max(maxGloss, ln.gloss.length);
  const cmdLen = res.raw.length * 15.5 + 80;
  const glossWidth = 220 + 34 + maxGloss * 9.6 + 40;
  return Math.ceil(Math.max(cmdLen, glossWidth));
}
function renderHtml(res, opts = {}) {
  const svg = renderSvg(res, opts);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>cmdxray \u2014 ${esc(res.raw)}</title>
<style>html,body{margin:0;background:#010409;color:#e6edf3;font-family:${FONT}}
.wrap{display:flex;justify-content:center;padding:32px}
figure{margin:0}</style></head>
<body><div class="wrap"><figure>${svg}</figure></div></body></html>`;
}
var ANSI = ["\x1B[38;5;75m", "\x1B[38;5;114m", "\x1B[38;5;215m", "\x1B[38;5;183m", "\x1B[38;5;203m", "\x1B[38;5;221m", "\x1B[38;5;80m", "\x1B[38;5;211m"];
var RESET = "\x1B[0m";
var DIM = "\x1B[2m";
function renderTerminal(res, color = true) {
  const c = (i, s) => color ? ANSI[i % ANSI.length] + s + RESET : s;
  const dim = (s) => color ? DIM + s + RESET : s;
  const cmdColors = colorByTokenIndex(res);
  const structural = /* @__PURE__ */ new Set(["pipe", "operator", "redirect"]);
  const cmdLine = res.parsed.tokens.map((tok, ti) => {
    if (structural.has(tok.kind)) return dim(tok.text);
    const ci = cmdColors.get(ti) ?? 0;
    return c(ci, tok.text);
  }).join(" ");
  const tokenWidth = Math.max(...res.lines.map((l) => l.token.length), 4);
  const rows = res.lines.map((ln) => `  ${c(ln.colorIndex, ln.token.padEnd(tokenWidth))}  ${ln.gloss}`).join("\n");
  return `
  ${cmdLine}

${rows}

  ${dim("explained locally \xB7 cmdxray")}
`;
}
export {
  DB,
  EXAMPLES,
  GENERIC_FLAGS,
  explain,
  parseCommand,
  renderHtml,
  renderSvg,
  renderTerminal
};
