// src/parse.ts
var OPERATORS = /* @__PURE__ */ new Set(["&&", "||", ";", "&"]);
var REDIRECTS = /* @__PURE__ */ new Set([">", ">>", "<", "<<", "2>", "2>>", "&>", ">&", "2>&1"]);
function lex(raw) {
  const words = [];
  let cur = "";
  let quoted = false;
  let started = false;
  let i = 0;
  const push = () => {
    if (cur.length) words.push({ text: cur, quoted });
    cur = "";
    quoted = false;
    started = false;
  };
  while (i < raw.length) {
    const c = raw[i];
    if (c === " " || c === "	" || c === "\n") {
      push();
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      if (!started) quoted = true;
      started = true;
      const q = c;
      i++;
      while (i < raw.length && raw[i] !== q) {
        cur += raw[i++];
      }
      i++;
      continue;
    }
    if (c === "$" && raw[i + 1] === "(") {
      started = true;
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
    started = true;
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
    takesValue: ["f", "C", "--exclude", "--exclude-from", "--strip-components", "-T"],
    bareFlags: true,
    flags: {
      c: "create a new archive",
      x: "extract files from an archive",
      t: "list the contents of an archive",
      r: "append files to the end of an archive",
      u: "append only files newer than the archive copy",
      z: "filter the archive through gzip (.gz)",
      j: "filter the archive through bzip2 (.bz2)",
      J: "filter the archive through xz (.xz)",
      v: "verbose \u2014 list each file as it is processed",
      f: "use the next argument as the archive file name",
      C: "change to the given directory first",
      p: "preserve file permissions when extracting",
      h: "follow symlinks \u2014 archive the files they point to",
      k: "keep existing files; don't overwrite when extracting",
      "--create": "create a new archive",
      "--extract": "extract files from an archive",
      "--list": "list the contents of an archive",
      "--gzip": "filter the archive through gzip",
      "--bzip2": "filter the archive through bzip2",
      "--xz": "filter the archive through xz",
      "--verbose": "verbose \u2014 list each file as it is processed",
      "--file": "use the given archive file",
      "--exclude": "skip files matching this pattern",
      "--exclude-from": "skip files matching patterns read from this file",
      "--exclude-vcs": "skip version-control dirs (.git, .svn, \u2026)",
      "--strip-components": "strip this many leading path parts when extracting"
    }
  },
  grep: {
    summary: "search input for lines matching a pattern",
    takesValue: ["e", "f", "A", "B", "C", "m", "d", "--include", "--exclude", "--exclude-dir", "--include-dir"],
    flags: {
      i: "ignore case when matching",
      v: "invert \u2014 show lines that do NOT match",
      r: "search directories recursively",
      R: "search directories recursively, following symlinks",
      n: "prefix each match with its line number",
      l: "print only the names of files with matches",
      L: "print only the names of files with NO match",
      c: "print only a count of matching lines",
      E: "interpret the pattern as an extended regex",
      F: "match fixed strings, not regexes",
      P: "interpret the pattern as a Perl-compatible regex (PCRE)",
      G: "interpret the pattern as a basic regex (the default)",
      o: "print only the matched part of each line",
      w: "match whole words only",
      x: "match only whole lines",
      I: "skip binary files (treat them as non-matching)",
      a: "treat binary files as text",
      H: "print the file name with each match",
      h: "never print the file name with matches",
      q: "quiet \u2014 print nothing, exit 0 on the first match",
      s: "suppress error messages about unreadable files",
      z: "treat input and output as NUL-separated lines",
      A: "also print N lines after each match",
      B: "also print N lines before each match",
      C: "also print N lines of context around each match",
      e: "use the next argument as the pattern",
      f: "read patterns from the given file",
      "--ignore-case": "ignore case when matching",
      "--invert-match": "show lines that do NOT match",
      "--recursive": "search directories recursively",
      "--line-number": "prefix each match with its line number",
      "--color": "highlight matches in color",
      "--include": "only search files whose name matches this glob",
      "--exclude": "skip files whose name matches this glob",
      "--exclude-dir": "skip directories whose name matches this glob",
      "--include-dir": "only descend into directories matching this glob",
      "--word-regexp": "match whole words only",
      "--fixed-strings": "match fixed strings, not regexes",
      "--files-with-matches": "print only the names of files with matches",
      "--count": "print only a count of matching lines",
      "--only-matching": "print only the matched part of each line",
      "--extended-regexp": "interpret the pattern as an extended regex",
      "--perl-regexp": "interpret the pattern as a Perl-compatible regex",
      "--quiet": "quiet \u2014 print nothing, exit 0 on the first match",
      "--no-filename": "never print the file name with matches",
      "--with-filename": "print the file name with each match"
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
      1: "list one entry per line",
      F: "append an indicator (/, *, @) to entries by type",
      i: "show each entry's inode number",
      "--color": "colorize the output (auto, always, never)",
      "--group-directories-first": "list directories before files"
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
    takesValue: ["O", "P", "--limit-rate", "e"],
    flags: {
      O: "write the download to the given file name",
      P: "save files into the given directory",
      c: "continue a partially downloaded file",
      q: "quiet \u2014 no output",
      r: "recursive \u2014 download linked pages too",
      "--show-progress": "always show the progress bar, even when quiet",
      "--no-check-certificate": "skip TLS certificate validation",
      "--limit-rate": "cap the download speed (e.g. 200k)",
      N: "only download if the remote file is newer than the local one",
      "--no-verbose": "turn off verbose output without going fully quiet"
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
      build: {
        t: "tag the built image (name:tag)",
        "--no-cache": "build without using any cached layers",
        "--build-arg": "set a build-time variable (NAME=value)",
        "--pull": "always pull a newer version of the base image",
        "--platform": "build for this target platform (e.g. linux/arm64)",
        "--target": "stop at this named build stage (multi-stage builds)",
        f: "use the given Dockerfile (--file)"
      },
      compose: {
        d: "detached \u2014 run the services in the background",
        "--build": "build images before starting the containers",
        "--no-cache": "don't use cache when building images",
        "--force-recreate": "recreate containers even if config is unchanged",
        "--remove-orphans": "remove containers for services not in the compose file",
        "-f": "use the given compose file"
      }
    },
    subTakesValue: {
      build: ["t", "--build-arg", "--platform", "--target", "f"],
      compose: ["-f"]
    },
    subSubcommands: {
      compose: {
        up: "create and start the services in the compose file",
        down: "stop and remove the services, networks and volumes",
        build: "build or rebuild the services' images",
        ps: "list the compose project's containers",
        logs: "show output from the services",
        exec: "run a command in a running service container",
        run: "run a one-off command against a service",
        start: "start existing service containers",
        stop: "stop running service containers",
        restart: "restart service containers",
        pull: "pull the services' images",
        config: "validate and print the resolved compose file"
      }
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
      commit: { n: "skip the pre-commit and commit-msg hooks (--no-verify)" },
      rebase: { i: "interactive \u2014 edit the list of commits before replaying them" }
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
      "--force-with-lease": "force-push only if the remote hasn't moved since you fetched",
      "--all": "operate on everything (all branches / all changes)",
      "--oneline": "show each commit on a single line",
      "--graph": "draw an ASCII graph of the branch structure",
      "--decorate": "show ref names (branches, tags) next to commits",
      "--continue": "resume the operation after resolving conflicts",
      "--abort": "cancel the operation and restore the original state",
      "--skip": "skip the current commit and continue",
      "--interactive": "interactive \u2014 edit the list of commits before replaying them",
      "--set-upstream": "record this remote branch as the upstream for tracking",
      "--no-verify": "skip the pre-commit and commit-msg hooks",
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
    takesValue: ["--omit", "--include", "-w", "--workspace"],
    flags: {
      g: "operate globally, not on the local project",
      D: "save to devDependencies",
      S: "save to dependencies (default)",
      "--save-dev": "save to devDependencies",
      "--save": "save to dependencies",
      "--global": "operate globally",
      "--production": "skip devDependencies",
      "--omit": "exclude a dependency type from install (e.g. dev)",
      "--include": "force-include a dependency type",
      "--force": "overwrite conflicts and bypass some checks",
      "--legacy-peer-deps": "ignore peer-dependency conflicts (npm v7+ behavior)",
      "--workspace": "run the command for this workspace only"
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
      "--failed": "limit output to failed units",
      "--no-pager": "print output directly instead of piping it to a pager",
      l: "show full output \u2014 do not truncate long lines",
      "--full": "show full output \u2014 do not truncate long lines",
      q: "quiet \u2014 suppress informational messages",
      "--quiet": "quiet \u2014 suppress informational messages",
      "--type": "limit to units of this type (service, socket, \u2026)"
    }
  },
  journalctl: {
    summary: "query and display logs from the systemd journal",
    takesValue: [
      "u",
      "--unit",
      "--since",
      "--until",
      "-p",
      "--priority",
      "-n",
      "--lines",
      "-t",
      "--identifier",
      "--user-unit",
      "-b",
      "--boot"
    ],
    flags: {
      u: "show logs for this systemd unit only",
      "--unit": "show logs for this systemd unit only",
      "--user-unit": "show logs for this per-user unit only",
      f: "follow \u2014 keep printing new log entries as they arrive",
      "--follow": "follow \u2014 keep printing new log entries as they arrive",
      "--since": 'only entries at or after this time (e.g. "1 hour ago")',
      "--until": "only entries at or before this time",
      n: "show only the last N lines",
      "--lines": "show only the last N lines",
      e: "jump to the end of the journal in the pager",
      "--pager-end": "jump to the end of the journal in the pager",
      r: "reverse \u2014 show newest entries first",
      "--reverse": "reverse \u2014 show newest entries first",
      k: "show only kernel messages",
      "--dmesg": "show only kernel messages",
      b: "show logs from a specific boot (default: current boot)",
      "--boot": "show logs from a specific boot (default: current boot)",
      x: "add explanatory help text to log messages where available",
      "--catalog": "add explanatory help text to log messages where available",
      p: "filter by priority (e.g. err, warning, or 0-7)",
      "--priority": "filter by priority (e.g. err, warning, or 0-7)",
      "--no-pager": "print straight to the terminal, don't use a pager",
      "--system": "show messages from system services and the kernel",
      "--user": "show messages from the current user's services",
      o: "set the output format (short, json, cat, \u2026)",
      "--output": "set the output format (short, json, cat, \u2026)"
    }
  },
  aws: {
    summary: "command-line interface for Amazon Web Services",
    subcommands: {
      s3: "high-level Amazon S3 object-storage commands (cp, sync, ls, rm\u2026)",
      s3api: "low-level, 1:1 mapping to the S3 API",
      ec2: "manage EC2 virtual machines, volumes, security groups\u2026",
      iam: "manage IAM users, roles, and permissions",
      lambda: "manage AWS Lambda serverless functions",
      logs: "CloudWatch Logs \u2014 view and query log groups",
      sts: "Security Token Service \u2014 assume roles, get caller identity",
      ecr: "Elastic Container Registry commands",
      eks: "manage Elastic Kubernetes Service clusters",
      configure: "set up credentials, region, and output defaults",
      dynamodb: "manage DynamoDB tables and items",
      ssm: "Systems Manager \u2014 parameters, session manager, run command"
    },
    subSubcommands: {
      s3: {
        cp: "copy files/objects to, from, or between S3",
        sync: "sync a directory tree to/from S3 (only changed files)",
        ls: "list buckets or objects",
        rm: "delete objects",
        mv: "move (copy then delete) objects",
        mb: "make (create) a bucket",
        rb: "remove (delete) a bucket"
      }
    },
    takesValue: [
      "--region",
      "--profile",
      "--output",
      "--acl",
      "--query",
      "--endpoint-url",
      "--sse",
      "--storage-class"
    ],
    flags: {
      "--recursive": "apply the command to all objects under the prefix/directory",
      "--acl": "set a canned access-control policy (e.g. public-read, private)",
      "--dryrun": "show what would happen without actually doing it",
      "--delete": "with sync: delete destination files missing from the source",
      "--exclude": "skip paths matching this pattern",
      "--include": "re-include paths (after --exclude) matching this pattern",
      "--profile": "use this named credentials profile",
      "--region": "target this AWS region",
      "--output": "output format: json, text, table, or yaml",
      "--query": "filter/reshape the output with a JMESPath expression",
      "--no-paginate": "return all results in one response, don't paginate",
      "--endpoint-url": "talk to this endpoint (e.g. an S3-compatible service)",
      "--sse": "server-side-encrypt uploaded objects",
      "--storage-class": "S3 storage class (STANDARD, GLACIER, \u2026)",
      "--version": "print the aws CLI version"
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
      "--watch": "watch for changes and stream updates",
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
    takesValue: ["--sort", "-o", "-p", "-u", "-C"],
    flags: {
      a: "show processes for all users",
      u: "show a user-oriented, detailed format",
      x: "include processes without a controlling terminal",
      e: "show every process",
      f: "full-format listing",
      "--sort": "order the output by this column (prefix - for descending)",
      "--forest": "show the process tree with ASCII art",
      "--no-headers": "omit the column header line"
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
  lsof: {
    summary: "list open files (and the processes that hold them open)",
    takesValue: ["i", "p", "u", "c"],
    flags: {
      i: "list network files \u2014 optionally filtered, e.g. -i :8080, -i tcp:80",
      p: "restrict to the given process ID(s)",
      u: "restrict to files opened by the given user(s)",
      c: "restrict to processes whose name begins with this string",
      n: "don't resolve host names \u2014 numeric addresses (faster)",
      P: "don't resolve port names \u2014 numeric ports (faster)",
      t: "terse output \u2014 print only process IDs (handy for scripting)",
      a: "AND the selection filters together instead of OR-ing them"
    }
  },
  ip: {
    summary: "show / manipulate routing, network devices, interfaces and tunnels",
    subcommands: {
      addr: "protocol (IP) addresses on network interfaces",
      address: "protocol (IP) addresses on network interfaces",
      a: "protocol (IP) addresses on network interfaces",
      link: "network devices (interfaces)",
      l: "network devices (interfaces)",
      route: "the routing table",
      r: "the routing table",
      neigh: "the ARP / neighbour table",
      rule: "routing policy rules",
      tunnel: "IP tunnels",
      maddr: "multicast addresses",
      monitor: "watch for network events as they happen"
    },
    subSubcommands: {
      addr: { show: "list the addresses", add: "add an address", del: "remove an address", flush: "remove all matching addresses" },
      address: { show: "list the addresses", add: "add an address", del: "remove an address", flush: "remove all matching addresses" },
      a: { show: "list the addresses", add: "add an address", del: "remove an address", flush: "remove all matching addresses" },
      link: { show: "list the devices", set: "change device settings", add: "create a virtual device", del: "delete a device" },
      l: { show: "list the devices", set: "change device settings" },
      route: { show: "list the routes", add: "add a route", del: "remove a route", get: "resolve the route for an address", flush: "remove all matching routes" },
      r: { show: "list the routes", add: "add a route", del: "remove a route", get: "resolve the route for an address" },
      neigh: { show: "list the neighbour entries", flush: "clear the neighbour table" }
    },
    flags: {
      "-4": "operate on IPv4 only",
      "-6": "operate on IPv6 only",
      "-br": "brief, tabular output",
      "-brief": "brief, tabular output",
      "-c": "colorize the output",
      "-s": "show statistics (repeat for more detail)",
      "-j": "output as JSON",
      "-json": "output as JSON",
      "-d": "show detailed output"
    }
  },
  crontab: {
    summary: "install, view, or edit a user's scheduled (cron) jobs",
    takesValue: ["u"],
    flags: {
      e: "edit the current crontab in your $EDITOR",
      l: "list (print) the current crontab",
      r: "remove the current crontab entirely",
      i: "prompt for confirmation before removing",
      u: "operate on the named user's crontab (needs privileges)"
    }
  },
  unzip: {
    summary: "extract files from a ZIP archive",
    takesValue: ["d", "x"],
    flags: {
      l: "list the archive contents without extracting",
      d: "extract into the given directory",
      o: "overwrite existing files without prompting",
      n: "never overwrite existing files",
      q: "quiet \u2014 suppress the per-file listing",
      p: "extract to standard output (pipe-friendly)",
      j: "junk paths \u2014 don't recreate the archive's directory tree",
      x: "exclude files matching the given name(s)",
      v: "verbose / show archive details"
    }
  },
  nc: {
    summary: "open, listen on, or script raw TCP/UDP connections (netcat)",
    takesValue: ["p", "w", "s"],
    flags: {
      l: "listen for an incoming connection instead of connecting",
      v: "verbose \u2014 report connections and errors",
      n: "numeric only \u2014 skip DNS/service-name lookups",
      p: "use this source port",
      u: "use UDP instead of TCP",
      k: "keep listening for more connections after one closes",
      w: "give up after this many seconds of inactivity (timeout)",
      z: "zero-I/O mode \u2014 just scan for listening ports, send no data",
      s: "use this source address"
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
  uniq: {
    summary: "report or omit repeated adjacent lines",
    takesValue: ["f", "s", "w"],
    flags: {
      c: "prefix each line with the number of times it occurred",
      d: "print only lines that are repeated",
      u: "print only lines that are never repeated",
      i: "ignore case when comparing lines",
      f: "skip the first N fields when comparing",
      s: "skip the first N characters when comparing",
      w: "compare no more than N characters per line"
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
  tee: {
    summary: "copy input to a file and pass it through to output too",
    flags: {
      a: "append to the file instead of overwriting it",
      i: "ignore interrupt signals"
    }
  },
  diff: {
    summary: "compare two files line by line and show the differences",
    takesValue: ["C", "U"],
    flags: {
      u: "unified format \u2014 the diff style used by patches and git",
      r: "recursively compare any subdirectories found",
      i: "ignore case differences",
      w: "ignore all whitespace",
      b: "ignore changes in the amount of whitespace",
      q: "report only whether files differ, not the details",
      N: "treat absent files as empty (with -r)",
      C: "output the given number of lines of copied context",
      U: "output the given number of lines of unified context"
    }
  },
  gzip: {
    summary: "compress files with gzip (replaces the original with .gz)",
    takesValue: ["S"],
    flags: {
      d: "decompress instead of compress",
      k: "keep the input file instead of deleting it",
      c: "write to standard output, keep the original",
      r: "recurse into directories",
      f: "force \u2014 overwrite existing files / compress links",
      v: "verbose \u2014 show the name and compression ratio",
      "9": "compress best (slowest); -1 is fastest, least compression"
    }
  },
  column: {
    summary: "format input into neatly aligned columns",
    takesValue: ["s", "c", "o"],
    flags: {
      t: "create a table, determining columns from the input",
      s: "use the given characters as input field separators",
      o: "use the given string to separate output columns",
      c: "format output to fit this display width",
      n: "do not merge multiple adjacent delimiters into one"
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
  },
  pip: {
    summary: "the Python package installer",
    subcommands: {
      install: "install packages",
      uninstall: "remove packages",
      list: "list installed packages",
      show: "show details about an installed package",
      freeze: "output installed packages in requirements format",
      download: "download packages without installing",
      wheel: "build wheel archives from requirements",
      check: "verify installed packages have compatible dependencies"
    },
    takesValue: ["r", "-r", "--requirement", "e", "-e", "--editable", "-c", "--constraint", "--index-url", "-i", "--extra-index-url", "--target", "-t"],
    flags: {
      r: "install from the given requirements file",
      e: "install a project in editable/development mode",
      U: "upgrade packages to the newest available version",
      "--requirement": "install from the given requirements file",
      "--editable": "install a project in editable/development mode",
      "--upgrade": "upgrade packages to the newest available version",
      "--user": "install to the per-user site-packages directory",
      "--no-cache-dir": "disable the wheel/download cache",
      "--no-deps": "don't install package dependencies",
      "--force-reinstall": "reinstall even if already up to date",
      "--index-url": "base URL of the package index to use",
      "--extra-index-url": "an additional package index to consult",
      "--target": "install packages into this directory",
      "--break-system-packages": "allow modifying an externally-managed environment"
    }
  },
  python: {
    summary: "the Python interpreter",
    takesValue: ["m", "c", "-W", "-X"],
    flags: {
      m: "run the named library module as a script",
      c: "run the given program passed as a string",
      i: "drop into interactive mode after running the script",
      u: "force stdout/stderr to be unbuffered",
      O: "enable basic optimizations (assert stripped)",
      B: "don't write .pyc bytecode files",
      E: "ignore PYTHON* environment variables",
      "--version": "print the Python version and exit"
    }
  },
  go: {
    summary: "the Go toolchain \u2014 build, test, and manage Go code",
    subcommands: {
      build: "compile packages and dependencies",
      run: "compile and run a Go program",
      test: "run package tests",
      get: "add or update a dependency in go.mod",
      install: "compile and install a package's binary",
      mod: "manage the module's go.mod file",
      fmt: "reformat source with gofmt",
      vet: "report likely mistakes in packages",
      generate: "run code generators marked with go:generate",
      clean: "remove object and cached files"
    },
    takesValue: ["o", "-o", "-tags", "-ldflags", "-run", "-count"],
    flags: {
      o: "write the output binary to this path",
      v: "print the names of packages as they compile",
      "-race": "enable the data-race detector",
      "-tags": "build tags to consider satisfied",
      "-ldflags": "flags to pass to the linker",
      "-run": "run only tests matching this regexp",
      "-count": "run each test this many times (use 1 to disable caching)",
      "-cover": "enable coverage analysis",
      "-bench": "run benchmarks matching this regexp"
    },
    subFlags: {
      mod: { init: "create a new go.mod", tidy: "add missing and remove unused modules", download: "download modules to the cache" }
    },
    subSubcommands: {
      mod: {
        init: "create a new go.mod in the current directory",
        tidy: "add missing and remove unused module requirements",
        download: "download modules to the local cache",
        vendor: "copy dependencies into a vendor directory"
      }
    }
  },
  cargo: {
    summary: "the Rust package manager and build tool",
    subcommands: {
      build: "compile the current package",
      run: "build and run a binary target",
      test: "run the package's tests",
      check: "type-check without producing a binary",
      add: "add a dependency to Cargo.toml",
      remove: "remove a dependency from Cargo.toml",
      update: "update dependencies in Cargo.lock",
      publish: "upload the crate to a registry (crates.io)",
      install: "build and install a Rust binary",
      new: "create a new cargo package",
      init: "create a cargo package in an existing directory",
      clippy: "run the Clippy linter",
      fmt: "format the code with rustfmt",
      bench: "run benchmarks"
    },
    takesValue: ["-p", "--package", "--bin", "--example", "--features", "--target"],
    flags: {
      "--release": "build with optimizations (the release profile)",
      "--all-features": "activate all Cargo features",
      "--no-default-features": "do not activate the default feature set",
      "--features": "space/comma-separated list of features to activate",
      "--workspace": "run the command for every package in the workspace",
      "--package": "run the command for this package only",
      "--bin": "build/run only this binary target",
      "--example": "build/run this example target",
      "--target": "build for the given target triple",
      "--locked": "require an up-to-date Cargo.lock and don't change it",
      "--offline": "run without accessing the network"
    }
  },
  gcloud: {
    summary: "the Google Cloud CLI",
    subcommands: {
      compute: "manage Compute Engine resources",
      storage: "manage Cloud Storage buckets and objects",
      auth: "manage credentials and authorization",
      config: "manage the local gcloud configuration",
      projects: "manage Cloud projects",
      container: "manage Kubernetes Engine (GKE) clusters",
      functions: "manage Cloud Functions",
      run: "manage Cloud Run services",
      iam: "manage identity and access management",
      app: "manage App Engine applications"
    },
    takesValue: ["--project", "--region", "--zone", "--account", "--format", "--configuration"],
    flags: {
      "--project": "the Cloud project ID to operate on",
      "--region": "the region to operate in",
      "--zone": "the zone to operate in",
      "--account": "the account to run the command as",
      "--format": "output format (json, yaml, table, value, \u2026)",
      "--quiet": "disable interactive prompts, use defaults",
      "--recursive": "recurse into directories (e.g. storage copies)",
      "--impersonate-service-account": "run the command as this service account"
    }
  },
  terraform: {
    summary: "infrastructure-as-code provisioning tool",
    subcommands: {
      init: "initialize a working directory and download providers",
      plan: "show the changes required to reach the desired state",
      apply: "create or update infrastructure to match the config",
      destroy: "remove all managed infrastructure",
      validate: "check whether the configuration is syntactically valid",
      fmt: "rewrite config files to the canonical format",
      output: "read an output value from state",
      state: "advanced state management",
      import: "associate existing infrastructure with a resource",
      workspace: "manage multiple named states"
    },
    takesValue: ["-var", "-var-file", "-target", "-state", "-out"],
    flags: {
      "-auto-approve": "skip the interactive approval prompt",
      "-var": "set a single input variable (name=value)",
      "-var-file": "load input variables from this file",
      "-target": "limit the operation to this resource address",
      "-out": "write the generated plan to this file",
      "-no-color": "disable colored output",
      "-json": "produce machine-readable JSON output",
      "-upgrade": "upgrade provider/module versions during init"
    }
  },
  gh: {
    summary: "the official GitHub CLI",
    subcommands: {
      repo: "manage repositories (create, clone, view, fork)",
      pr: "manage pull requests (create, checkout, merge, \u2026)",
      issue: "manage issues (create, list, close, \u2026)",
      release: "manage releases",
      run: "view and manage GitHub Actions runs",
      workflow: "view and manage GitHub Actions workflows",
      auth: "authenticate gh and manage credentials",
      api: "make an authenticated GitHub API request",
      gist: "manage gists",
      secret: "manage repository/organization secrets"
    },
    takesValue: ["-R", "--repo", "-t", "--title", "-b", "--body", "-F", "--field", "-f"],
    flags: {
      R: "operate on the given owner/repo instead of the current one",
      "--repo": "operate on the given owner/repo instead of the current one",
      "--title": "set the title (PR/issue/release)",
      "--body": "set the body text (PR/issue/release)",
      "--web": "open the relevant page in a browser",
      "--json": "output selected fields as JSON",
      "--jq": "filter JSON output with a jq expression"
    },
    subFlags: {
      pr: { "-B": "the base branch to merge into", "-d": "delete the branch after merge", "-s": "squash the commits when merging" }
    }
  },
  yarn: {
    summary: "an alternative Node.js package manager",
    subcommands: {
      install: "install project dependencies",
      add: "add a dependency to the project",
      remove: "remove a dependency",
      run: "run a script defined in package.json",
      build: "run the build script",
      test: "run the test script",
      upgrade: "upgrade dependencies to their latest allowed versions",
      dlx: "download and run a package one-off (Yarn Berry)",
      why: "explain why a package is installed"
    },
    takesValue: [],
    flags: {
      D: "add to devDependencies",
      "--dev": "add to devDependencies",
      "--frozen-lockfile": "fail rather than update the lockfile (Yarn 1)",
      "--immutable": "fail if the lockfile would change (Yarn Berry)",
      "--production": "skip devDependencies",
      "--global": "operate on the global package set"
    }
  },
  pnpm: {
    summary: "a fast, disk-efficient Node.js package manager",
    subcommands: {
      install: "install project dependencies",
      add: "add a dependency to the project",
      remove: "remove a dependency",
      run: "run a script defined in package.json",
      dlx: "download and run a package one-off",
      exec: "run a command from a local dependency's binaries",
      update: "update dependencies to newer allowed versions",
      why: "show which packages depend on a given one"
    },
    takesValue: ["--filter", "-C", "--dir"],
    flags: {
      D: "add to devDependencies",
      "--save-dev": "add to devDependencies",
      "--frozen-lockfile": "fail rather than update the lockfile",
      "--prod": "install only production dependencies",
      "-r": "run the command in every workspace package (recursive)",
      "--recursive": "run the command in every workspace package",
      "--filter": "restrict the command to matching workspace packages",
      "-g": "operate on globally-installed packages",
      "--global": "operate on globally-installed packages"
    }
  },
  zip: {
    summary: "package and compress files into a .zip archive",
    takesValue: ["x", "-x", "i", "-i"],
    flags: {
      r: "recurse into directories",
      q: "quiet \u2014 suppress normal output",
      v: "verbose output (or print version when used alone)",
      "0": "store only \u2014 no compression",
      "9": "compress better (slowest)",
      e: "encrypt the archive, prompting for a password",
      m: "move files into the zip \u2014 delete the originals after adding",
      j: "junk paths \u2014 store just the file names, not directories",
      u: "update \u2014 add new files and replace changed ones",
      x: "exclude files matching the given pattern",
      i: "include only files matching the given pattern"
    }
  },
  sudo: {
    summary: "run a command as another user (root by default)",
    takesValue: ["u", "g", "p"],
    flags: {
      u: "run as this user instead of root",
      g: "run as this group",
      i: "start a fresh login shell as the target user",
      s: "run a shell as the target user",
      k: "invalidate the cached credentials (force a re-prompt next time)",
      l: "list the commands you're allowed to run",
      b: "run the command in the background",
      E: "preserve your current environment variables",
      H: "set HOME to the target user's home directory",
      n: "non-interactive \u2014 fail rather than prompt for a password",
      p: "use this custom password prompt"
    }
  },
  touch: {
    summary: "create empty files, or update a file's access/modification times",
    takesValue: ["d", "t", "r"],
    flags: {
      a: "change only the access time",
      m: "change only the modification time",
      c: "don't create the file if it doesn't already exist",
      r: "use this reference file's timestamps instead of now",
      d: "set the time from a human-readable date string",
      t: "set the time from a [[CC]YY]MMDDhhmm[.ss] stamp"
    }
  },
  less: {
    summary: "view text one screen at a time (a pager)",
    takesValue: ["x"],
    flags: {
      N: "show line numbers",
      S: "chop long lines instead of wrapping them",
      i: "ignore case in searches",
      F: "quit immediately if the content fits on one screen",
      R: "pass ANSI color escape sequences through unchanged",
      X: "don't clear the screen on exit",
      x: "set the tab width in columns"
    }
  },
  date: {
    summary: "print or set the system date and time",
    takesValue: ["d", "r", "s"],
    flags: {
      u: "use UTC instead of local time",
      d: "print the given date string instead of the current time",
      s: "set the system clock to the given time",
      r: "show the last-modified time of the given file",
      I: "output in ISO 8601 format",
      R: "output in RFC 5322 format (for email headers)"
    }
  },
  echo: {
    summary: "print text to standard output",
    takesValue: [],
    flags: {
      n: "don't print the trailing newline",
      e: "interpret backslash escapes like \n and 	",
      E: "don't interpret backslash escapes (the default)"
    }
  },
  printf: {
    summary: "format and print data using a printf-style template",
    takesValue: [],
    flags: {
      v: "store the output in a shell variable instead of printing it"
    }
  },
  base64: {
    summary: "encode or decode data in Base64",
    takesValue: ["w"],
    flags: {
      d: "decode Base64 input instead of encoding",
      i: "ignore non-alphabet characters while decoding",
      w: "wrap encoded lines after this many characters (0 = no wrap)"
    }
  },
  env: {
    summary: "show the environment, or run a command with a modified one",
    takesValue: ["u", "C"],
    flags: {
      i: "start with a completely empty environment",
      u: "remove this variable from the environment",
      "0": "end each output line with NUL instead of a newline",
      C: "change to this directory before running the command"
    }
  },
  dig: {
    summary: "query DNS name servers (a DNS lookup tool)",
    takesValue: ["t", "p", "x", "b"],
    flags: {
      x: "do a reverse lookup on the given IP address",
      t: "query for this record type (A, AAAA, MX, TXT, NS\u2026)",
      p: "query the server on this port instead of 53",
      "4": "use IPv4 transport only",
      "6": "use IPv6 transport only",
      b: "send the query from this source address"
    }
  },
  watch: {
    summary: "run a command repeatedly and watch its output update",
    takesValue: ["n"],
    flags: {
      n: "set the interval between runs, in seconds",
      d: "highlight what changed between updates",
      t: "hide the header showing the interval and command",
      g: "exit as soon as the output first changes",
      b: "beep if the command exits non-zero",
      e: "freeze and wait for a key if the command errors"
    }
  },
  uname: {
    summary: "print system and kernel information",
    takesValue: [],
    flags: {
      a: "print everything",
      s: "the kernel name",
      r: "the kernel release",
      v: "the kernel version",
      m: "the machine hardware name",
      n: "the network node hostname",
      o: "the operating system",
      p: "the processor type"
    }
  },
  sha256sum: {
    summary: "compute or verify SHA-256 checksums",
    takesValue: ["c"],
    flags: {
      c: "read checksums from a file and verify them",
      b: "read the files in binary mode",
      t: "read the files in text mode",
      "--quiet": "don't print OK for each file that verifies",
      "--ignore-missing": "don't fail for files that are missing when verifying"
    }
  },
  free: {
    summary: "show memory and swap usage",
    takesValue: ["s", "c"],
    flags: {
      h: "human-readable units (KiB/MiB/GiB)",
      m: "show the amounts in mebibytes",
      g: "show the amounts in gibibytes",
      b: "show the amounts in bytes",
      s: "refresh continuously every N seconds",
      c: "stop after this many refreshes",
      t: "add a line showing the totals"
    }
  },
  top: {
    summary: "show a live, sorted view of running processes",
    takesValue: ["d", "p", "u", "n"],
    flags: {
      d: "set the refresh delay in seconds",
      n: "exit after this many refreshes",
      p: "monitor only these process IDs",
      u: "show only this user's processes",
      b: "batch mode \u2014 plain output for logs or pipes",
      i: "hide idle processes"
    }
  },
  mount: {
    summary: "attach a filesystem to the directory tree (or list current mounts)",
    takesValue: ["t", "o"],
    flags: {
      t: "specify the filesystem type (ext4, xfs, nfs\u2026)",
      o: "pass a comma-separated list of mount options",
      a: "mount everything listed in /etc/fstab",
      r: "mount the filesystem read-only",
      w: "mount the filesystem read-write",
      v: "verbose output",
      B: "bind-mount an existing directory somewhere else"
    }
  },
  umount: {
    summary: "detach (unmount) a mounted filesystem",
    takesValue: ["t", "O"],
    flags: {
      a: "unmount every filesystem listed in /etc/mtab",
      f: "force the unmount (useful for an unreachable NFS mount)",
      l: "lazy unmount \u2014 detach now, clean up once it is no longer busy",
      r: "if the unmount fails, remount the filesystem read-only instead",
      n: "unmount without writing to /etc/mtab",
      R: "recursively unmount the given directory and everything below it",
      t: "act only on filesystems of the given type",
      v: "verbose output",
      O: "act only on filesystems with the given mount options"
    }
  },
  which: {
    summary: "locate a command \u2014 print the full path of the executable that would run",
    flags: {
      a: "print ALL matching executables on PATH, not just the first",
      s: "print nothing; just set exit status (found / not found)"
    }
  },
  whoami: {
    summary: "print the effective user name of the current user",
    flags: {}
  },
  hostname: {
    summary: "show or set the system's host name",
    flags: {
      I: "print all network addresses of the host (space-separated)",
      i: "print the host's IP address(es)",
      f: "print the fully-qualified domain name (FQDN)",
      s: "print the short host name (everything up to the first dot)",
      d: "print the DNS domain name",
      a: "print the host's alias names"
    }
  },
  ifconfig: {
    summary: "configure or display network-interface settings (legacy; prefer `ip`)",
    flags: {
      a: "show all interfaces, including ones that are down",
      s: "short listing, like `netstat -i`",
      v: "verbose \u2014 show extra error details"
    }
  },
  "ssh-keygen": {
    summary: "generate, manage and convert SSH authentication keys",
    takesValue: ["t", "b", "C", "f", "N", "R", "F"],
    flags: {
      t: "type of key to create (ed25519, rsa, ecdsa)",
      b: "number of bits in the key",
      C: "comment to attach to the key (often your email)",
      f: "key file to write to or read from",
      N: "new passphrase for the key ('' means no passphrase)",
      p: "change the passphrase of an existing private key",
      y: "read a private key and print its public key",
      l: "show the fingerprint of a key file",
      R: "remove all keys for the given hostname from known_hosts",
      F: "search known_hosts for the given hostname",
      q: "quiet \u2014 suppress the usual output"
    }
  },
  stat: {
    summary: "display detailed file status \u2014 size, permissions, timestamps, inode",
    takesValue: ["c", "--format", "--printf"],
    flags: {
      c: "use the given custom output format",
      f: "report on the filesystem the file lives on, not the file",
      t: "terse output \u2014 one line of raw numbers",
      L: "follow symlinks \u2014 stat the file they point to",
      "--format": "use the given output format (add a trailing newline)",
      "--printf": "like --format, but interpret backslash escapes and add no newline",
      "--dereference": "follow symlinks"
    }
  },
  file: {
    summary: "identify a file's type by inspecting its contents, not its name",
    flags: {
      b: "brief \u2014 don't print the file name, just the type",
      i: "print a MIME type string instead of human-readable text",
      z: "look inside compressed files",
      L: "follow symlinks",
      s: "read block/character special files (devices) too",
      k: "keep going \u2014 report all matches, not just the first",
      "--mime": "print the MIME type",
      "--mime-type": "print only the MIME type (e.g. text/plain)"
    }
  },
  basename: {
    summary: "strip the directory (and optionally a suffix) from a path, leaving the file name",
    takesValue: ["s"],
    flags: {
      a: "treat every argument as a name to strip (process multiple)",
      s: "remove the given trailing suffix from the name",
      z: "end each output line with NUL instead of a newline"
    }
  },
  dirname: {
    summary: "strip the last component from a path, leaving the directory portion",
    flags: {
      z: "end each output line with NUL instead of a newline"
    }
  },
  realpath: {
    summary: "resolve a path to its absolute, symlink-free canonical form",
    takesValue: ["--relative-to", "--relative-base"],
    flags: {
      e: "require every path component to exist (error otherwise)",
      m: "allow missing components \u2014 resolve the path anyway",
      s: "don't expand symlinks (only collapse . and .. and slashes)",
      z: "end each output line with NUL instead of a newline",
      "--relative-to": "print the result relative to the given directory",
      "--relative-base": "print relative when under this dir, else absolute"
    }
  },
  md5sum: {
    summary: "compute or verify MD5 checksums (128-bit; use sha256sum for security)",
    flags: {
      c: "read checksums from the given file(s) and verify them",
      b: "read files in binary mode",
      t: "read files in text mode (the default)",
      "--check": "verify checksums listed in a file",
      "--quiet": "with -c, don't print OK for each verified file",
      "--ignore-missing": "with -c, don't fail over files that are missing",
      "--status": "with -c, print nothing \u2014 signal the result via exit code"
    }
  },
  tree: {
    summary: "list directory contents as an indented tree",
    takesValue: ["L", "P", "I"],
    flags: {
      L: "descend only this many directory levels deep",
      a: "include hidden files (dotfiles)",
      d: "list directories only",
      f: "print the full path prefix for each entry",
      i: "don't indent \u2014 print a flat list (pair with -f)",
      h: "print sizes in human-readable form",
      p: "show the type and permissions of each entry",
      s: "print the size of each file",
      P: "list only files matching the given pattern",
      I: "do NOT list files matching the given pattern",
      "--du": "show each directory's size as the sum of its contents",
      "--dirsfirst": "list directories before files"
    }
  },
  htop: {
    summary: "interactive process and resource viewer (a friendlier `top`)",
    takesValue: ["d", "u", "p", "s"],
    flags: {
      d: "delay between updates, in tenths of a second",
      u: "show only processes owned by the given user",
      p: "monitor only the given PIDs (comma-separated)",
      s: "sort by the given column on startup",
      t: "start in tree view",
      C: "use a monochrome (no-color) scheme",
      H: "hide user threads",
      "--tree": "show processes as a parent/child tree"
    }
  },
  pkill: {
    summary: "signal processes selected by name or attribute \u2014 no PID needed",
    takesValue: ["u", "U", "t"],
    flags: {
      f: "match against the full command line, not just the process name",
      u: "match processes with the given effective user",
      U: "match processes with the given real user",
      x: "require an exact match of the process name",
      n: "select only the newest matching process",
      o: "select only the oldest matching process",
      c: "print a count of matches instead of signalling them",
      "9": "SIGKILL \u2014 force the matching processes to stop immediately",
      "15": "SIGTERM \u2014 politely ask the matching processes to stop"
    }
  },
  killall: {
    summary: "kill all processes matching a given name",
    takesValue: ["u", "s"],
    flags: {
      i: "ask for confirmation before killing each process",
      u: "kill only processes owned by the given user",
      v: "report whether each signal was sent successfully",
      w: "wait for the killed processes to actually die",
      e: "require an exact match for long process names",
      I: "match the process name case-insensitively",
      g: "kill the process group instead of the process",
      s: "send the named signal instead of SIGTERM",
      "9": "SIGKILL \u2014 force the matching processes to stop immediately"
    }
  },
  sleep: {
    summary: "pause for a given amount of time before returning",
    flags: {
      "--help": "show usage information and exit",
      "--version": "print version information and exit"
    }
  },
  timeout: {
    summary: "run a command, killing it if it runs longer than a time limit",
    takesValue: ["s", "k", "--signal", "--kill-after"],
    flags: {
      s: "send this signal instead of SIGTERM when time runs out",
      k: "if still alive after this long, follow up with SIGKILL",
      "--signal": "send this signal instead of SIGTERM when time runs out",
      "--kill-after": "if still alive after this long, follow up with SIGKILL",
      "--preserve-status": "exit with the command's own status, not 124",
      "--foreground": "let the command read from the terminal (don't isolate it)",
      v: "verbose \u2014 announce when the command is being signalled",
      "--verbose": "verbose \u2014 announce when the command is being signalled"
    }
  },
  seq: {
    summary: "print a sequence of numbers, from FIRST to LAST",
    takesValue: ["s", "f", "-w"],
    flags: {
      s: "use this string to separate numbers (default: newline)",
      f: "format each number with this printf-style float format",
      w: "pad numbers with leading zeros to equal width",
      "--separator": "use this string to separate numbers",
      "--format": "format each number with this printf-style float format",
      "--equal-width": "pad numbers with leading zeros to equal width"
    }
  },
  nohup: {
    summary: "run a command immune to hangups, ignoring SIGHUP so it survives logout",
    flags: {
      "--help": "show usage information and exit",
      "--version": "print version information and exit"
    }
  },
  nslookup: {
    summary: "query DNS name servers for a domain's records interactively or in one shot",
    flags: {
      "-type": "query this record type (e.g. -type=MX, -type=NS)",
      "-query": "query this record type (alias of -type)",
      "-debug": "show the full debugging detail of each response",
      "-port": "query the server on this port instead of 53"
    }
  },
  traceroute: {
    summary: "trace the network hops (routers) packets take to reach a host",
    takesValue: ["m", "q", "w", "p", "f"],
    flags: {
      n: "show numeric addresses; don't resolve hop names via DNS",
      I: "use ICMP ECHO probes instead of UDP datagrams",
      T: "use TCP SYN probes (handy through firewalls)",
      m: "set the maximum number of hops (TTL) to probe",
      q: "send this many probe packets per hop (default 3)",
      w: "wait this many seconds for a reply before giving up",
      p: "use this base destination port for probes",
      f: "start probing from this first TTL (hop) instead of 1"
    }
  },
  sha1sum: {
    summary: "compute or check SHA-1 (160-bit) checksums of files",
    flags: {
      c: "read checksums from the files and verify them",
      b: "read files in binary mode",
      t: "read files in text mode (default)",
      "--check": "read checksums from the files and verify them",
      "--quiet": "when checking, don't print OK for each verified file",
      "--status": "when checking, print nothing; signal result via exit code",
      "--ignore-missing": "when checking, don't fail for missing files"
    }
  },
  xz: {
    summary: "compress or decompress files with the LZMA2 algorithm (.xz)",
    takesValue: ["T", "--threads"],
    flags: {
      z: "compress (the default action)",
      d: "decompress",
      k: "keep \u2014 don't delete the input file after (de)compressing",
      f: "force overwrite of the output and (de)compress even unusual files",
      c: "write to standard output; leave files unchanged",
      l: "list information about the compressed .xz file",
      t: "test the integrity of the compressed file",
      "9": "use the maximum compression level (slowest, smallest)",
      "0": "use the fastest compression level (largest)",
      e: "use extra effort for a slightly smaller file",
      T: "use this many worker threads (0 = one per CPU)",
      v: "verbose \u2014 show progress and stats",
      "--threads": "use this many worker threads (0 = one per CPU)",
      "--keep": "keep \u2014 don't delete the input file",
      "--decompress": "decompress"
    }
  },
  bzip2: {
    summary: "compress or decompress files with the Burrows-Wheeler algorithm (.bz2)",
    flags: {
      z: "compress (the default action)",
      d: "decompress",
      k: "keep \u2014 don't delete the input file after (de)compressing",
      f: "force overwrite of existing output files",
      c: "write to standard output; leave files unchanged",
      t: "test the integrity of the compressed file",
      "9": "use the largest block size \u2014 best compression (default)",
      "1": "use the smallest block size \u2014 least memory",
      v: "verbose \u2014 show the compression ratio for each file",
      "--decompress": "decompress",
      "--keep": "keep \u2014 don't delete the input file"
    }
  },
  paste: {
    summary: "merge lines of files side by side, separated by tabs",
    takesValue: ["d", "--delimiters"],
    flags: {
      d: "use these characters instead of tab to separate columns",
      s: "paste one file at a time \u2014 its lines onto a single row",
      z: "treat input and output lines as NUL-terminated",
      "--delimiters": "use these characters instead of tab to separate columns",
      "--serial": "paste one file at a time onto a single row"
    }
  },
  comm: {
    summary: "compare two SORTED files line by line, in three columns",
    flags: {
      "1": "suppress column 1 \u2014 lines unique to the first file",
      "2": "suppress column 2 \u2014 lines unique to the second file",
      "3": "suppress column 3 \u2014 lines common to both files",
      i: "compare lines case-insensitively",
      "--check-order": "fail if either input is not properly sorted",
      "--nocheck-order": "do not check that the input is sorted",
      "--total": "also print a summary count line"
    }
  },
  nl: {
    summary: "number the lines of a file as it writes them out",
    takesValue: ["b", "w", "s", "v", "i"],
    flags: {
      b: "which lines to number: a=all, t=non-empty (default), n=none",
      w: "use this column width for the line numbers",
      s: "put this string between the number and the text",
      v: "start numbering at this value",
      i: "increment the line number by this step",
      n: "number format: ln, rn (default), or rz (zero-padded)"
    }
  },
  tac: {
    summary: "concatenate and print files in reverse \u2014 last line first",
    takesValue: ["s", "--separator"],
    flags: {
      s: "use this string as the line separator instead of newline",
      r: "treat the separator as a regular expression",
      b: "attach the separator before, rather than after, each line",
      "--separator": "use this string as the line separator instead of newline",
      "--before": "attach the separator before each line"
    }
  },
  rev: {
    summary: "reverse the order of characters on every line",
    flags: {
      "--help": "show usage information and exit",
      "--version": "print version information and exit"
    }
  },
  "ssh-copy-id": {
    summary: "install your public SSH key into a remote host's authorized_keys",
    takesValue: ["i", "p", "o"],
    flags: {
      i: "use this identity (public key) file",
      p: "connect to this port on the remote host",
      o: "pass this option through to ssh",
      f: "force \u2014 copy the key even if it appears to be installed already",
      n: "dry run \u2014 show which keys would be installed, but don't"
    }
  },
  sftp: {
    summary: "interactive secure file transfer over SSH",
    takesValue: ["P", "i", "o", "b", "l"],
    flags: {
      P: "connect to this port on the remote host",
      i: "use this identity (private key) file",
      o: "pass this option through to ssh",
      b: "read batch commands from this file (non-interactive)",
      r: "recursively copy entire directories",
      l: "limit the transfer bandwidth (Kbit/s)",
      a: "resume (append to) partial transfers of existing files"
    }
  },
  vim: {
    summary: "Vi IMproved \u2014 a modal terminal text editor",
    takesValue: ["u", "c", "S"],
    flags: {
      R: "open the file read-only (view mode)",
      m: "disable modifications (writing is turned off)",
      d: "start in diff mode, like vimdiff",
      o: "open the files in horizontally split windows",
      O: "open the files in vertically split windows",
      p: "open the files in separate tabs",
      u: "use this config file instead of ~/.vimrc",
      c: "run this Ex command after loading the first file",
      S: "source this session/script file after loading",
      e: "start in line-based Ex mode"
    }
  },
  nano: {
    summary: "a simple, friendly terminal text editor",
    takesValue: ["T", "r", "Y"],
    flags: {
      l: "show line numbers in the left margin",
      i: "automatically indent new lines to match the previous one",
      m: "enable mouse support",
      w: "don't hard-wrap long lines",
      c: "constantly show the cursor position",
      B: "save a backup of the previous version of the file",
      S: "use smooth (line-by-line) scrolling",
      T: "set the width of a tab in columns",
      r: "hard-wrap lines at this column",
      Y: "use this syntax-highlighting definition",
      v: "open the file in view (read-only) mode"
    }
  },
  man: {
    summary: "display the on-line manual page for a command",
    takesValue: ["M", "P"],
    flags: {
      k: "search the short descriptions of all pages (apropos)",
      f: "show the one-line description of a page (whatis)",
      a: "show all matching manual pages, not just the first",
      w: "print the file location of the manual page instead of showing it",
      K: "search for a string in the full text of all pages",
      M: "look for pages in this manual-path directory",
      P: "use this program as the pager"
    }
  },
  id: {
    summary: "print user and group identity (UID, GID, groups)",
    flags: {
      u: "print only the effective user ID",
      g: "print only the effective (primary) group ID",
      G: "print all group IDs the user belongs to",
      n: "print names instead of numeric IDs",
      r: "print the real ID instead of the effective one"
    }
  },
  who: {
    summary: "show who is currently logged in",
    flags: {
      a: "show all available information",
      b: "show the time of the last system boot",
      H: "print a header row of column titles",
      q: "print only login names and a count of logged-in users",
      u: "include how long each user has been idle",
      m: "show information only for the current terminal",
      r: "show the current runlevel"
    }
  },
  uptime: {
    summary: "show how long the system has been running plus load averages",
    flags: {
      p: "show the uptime in a pretty, human-readable form",
      s: "show the date and time the system booted"
    }
  },
  su: {
    summary: "switch to another user and start a shell (defaults to root)",
    takesValue: ["c", "s"],
    flags: {
      l: "start a login shell, giving the target user's full environment",
      c: "run this single command as the target user, then exit",
      s: "run this shell instead of the target user's default",
      p: "preserve the current environment instead of resetting it"
    }
  },
  gpg: {
    summary: "GNU Privacy Guard \u2014 encrypt, decrypt, and sign data",
    takesValue: ["o", "r", "u"],
    flags: {
      c: "encrypt with a symmetric passphrase (no keys needed)",
      e: "encrypt the input for one or more recipients",
      d: "decrypt the input",
      s: "make a signature",
      a: "produce ASCII-armored (text) output instead of binary",
      b: "make a detached signature (separate .sig file)",
      v: "verbose output",
      o: "write output to this file",
      r: "encrypt for this recipient (key ID or email)",
      u: "sign using this local key",
      "--gen-key": "interactively generate a new key pair",
      "--full-generate-key": "generate a key pair with all options prompted",
      "--list-keys": "list the public keys in your keyring",
      "--export": "export a public key",
      "--import": "import keys from a file",
      "--verify": "verify a signature"
    }
  },
  tmux: {
    summary: "terminal multiplexer \u2014 persistent sessions with split panes",
    takesValue: ["t", "s", "L", "f"],
    subcommands: {
      new: "create a new session",
      "new-session": "create a new session",
      attach: "attach to an existing session",
      "attach-session": "attach to an existing session",
      ls: "list sessions",
      "list-sessions": "list sessions",
      "kill-session": "terminate a single session",
      "kill-server": "terminate the tmux server and every session",
      "rename-session": "rename a session",
      "split-window": "split the current pane into two",
      detach: "detach the client from its session"
    },
    flags: {
      t: "target session or window",
      s: "name for a new session",
      d: "start the session detached (or detach other clients)",
      a: "attach to an existing session",
      L: "use this socket name for the server",
      f: "use this alternate config file"
    }
  },
  lsblk: {
    summary: "list block devices (disks and their partitions) as a tree",
    takesValue: ["o"],
    flags: {
      a: "also list empty (zero-size) devices",
      f: "show filesystem info \u2014 type, label, and UUID",
      m: "show permission info \u2014 owner, group, and mode",
      p: "print full device paths (/dev/sda) instead of names",
      b: "print sizes in bytes rather than human units",
      l: "use a flat list instead of the tree layout",
      n: "don't print the header line",
      o: "choose exactly which columns to show",
      S: "list only SCSI devices"
    }
  },
  dmesg: {
    summary: "print or control the kernel ring buffer (boot and driver messages)",
    takesValue: ["l", "f"],
    flags: {
      H: "human-readable output with colors and relative time",
      w: "wait and keep printing new messages as they arrive (follow)",
      T: "show human-readable timestamps",
      c: "clear the ring buffer after printing its contents",
      l: "restrict output to these log levels (e.g. err,warn)",
      f: "restrict output to these facilities (e.g. kern)",
      k: "print kernel messages",
      u: "print userspace messages",
      x: "show the facility and level of each line as text"
    }
  },
  mktemp: {
    summary: "safely create a unique temporary file or directory and print its name",
    takesValue: ["p", "--suffix"],
    flags: {
      d: "create a directory instead of a file",
      u: "only print an unused name without creating anything (unsafe)",
      q: "suppress diagnostics if creation fails",
      p: "create the file/dir in this directory instead of $TMPDIR",
      t: "interpret the template relative to the temp directory",
      "--suffix": "append this suffix to the generated name"
    }
  },
  gunzip: {
    summary: "decompress .gz files created by gzip",
    flags: {
      k: "keep (don't delete) the compressed input file",
      c: "write the result to stdout and keep the original",
      f: "force decompression, overwriting existing files",
      v: "verbose \u2014 show name and compression ratio",
      t: "test the integrity of the compressed file without extracting",
      l: "list the contents and compression stats of an archive",
      r: "recurse into directories, decompressing every file"
    }
  },
  history: {
    summary: "display or manage the shell command history (shell builtin)",
    takesValue: ["d"],
    flags: {
      c: "clear the entire history list",
      d: "delete the history entry at this position",
      a: "append the new history lines to the history file",
      r: "read the history file and append it to the current list",
      w: "write the current history out to the history file",
      n: "read the history lines not already read from the file"
    }
  },
  alias: {
    summary: "define or display command shortcuts (shell builtin)",
    flags: {
      p: "print all defined aliases in a reusable form"
    }
  },
  export: {
    summary: "mark shell variables for export to child processes (shell builtin)",
    flags: {
      p: "display all exported variables in a reusable form",
      n: "remove the export property from the named variables",
      f: "treat the names as shell functions rather than variables"
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
  ls: ["ls -la", "ls -lhSr", "ls -la --color=auto -F"],
  rm: ["rm -rf build", "rm -i note.txt"],
  cp: ["cp -r src dest", "cp -p a.txt b.txt"],
  mv: ["mv -i old new", "mv -v a b"],
  mkdir: ["mkdir -p a/b/c", "mkdir -m 755 dir"],
  ln: ["ln -s /usr/bin/python3 python", "ln -sf target link"],
  curl: ["curl -sSL -o out.html https://example.com", "curl -X POST -H 'A: b' -d data url"],
  wget: ["wget -c -O file.zip https://example.com/f.zip", "wget -c -q --show-progress --limit-rate=200k https://x.com/f.iso"],
  find: ["find . -name '*.log' -mtime +30 -delete", "find src -type f -maxdepth 2"],
  ffmpeg: ["ffmpeg -i in.mov -c:v libx264 -crf 23 -preset medium out.mp4", "ffmpeg -i in.mp4 -vf scale=1280:-1 -an out.webm"],
  openssl: ["openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes", "openssl s_client -connect example.com:443 -servername example.com"],
  chmod: ["chmod -R 755 dir", "chmod -v 600 key"],
  chown: ["chown -R user:group dir"],
  ssh: ["ssh -i key.pem -p 2222 user@host", "ssh -N -L 8080:localhost:80 host"],
  scp: ["scp -r -P 22 file user@host:/tmp"],
  rsync: ["rsync -avz --delete src/ dest/", "rsync -a --dry-run a/ b/"],
  docker: ["docker run -it --rm -p 8080:80 nginx", "docker build -t myimg .", "docker build -t app:1.0 --no-cache --build-arg VERSION=1 ."],
  git: ["git commit -am 'fix bug'", "git checkout -b feature", "git log --oneline --graph --all --decorate"],
  npm: ["npm install -D typescript", "npm run build", "npm ci --omit=dev"],
  systemctl: ["systemctl restart nginx", "systemctl enable --now docker", "systemctl status nginx --no-pager -l"],
  journalctl: ['journalctl -u nginx --since "1 hour ago" -f', "journalctl -xe -p err"],
  aws: ["aws s3 cp ./dist s3://mybucket/ --recursive --acl public-read", "aws s3 sync . s3://bucket --delete"],
  kubectl: ["kubectl get pods -n default -o wide", "kubectl logs -f mypod", "kubectl get pods -n kube-system -o wide --watch"],
  apt: ["apt install -y curl", "apt upgrade --yes"],
  sed: ["sed -i 's/a/b/g' file.txt", "sed -n -e '1,10p' file.txt"],
  awk: ["awk -F, '{print $1}' data.csv"],
  jq: ["jq -r '.items[] | select(.age > 30) | .name' data.json"],
  ps: ["ps aux", "ps -ef", "ps aux --sort=-%mem"],
  netstat: ["netstat -tulpn", "netstat -rn"],
  ss: ["ss -tulpn", "ss -s"],
  lsof: ["lsof -i :8080", "lsof -p 1234", "lsof -nP -i tcp"],
  ip: ["ip addr show", "ip route add default via 192.168.1.1", "ip -br link"],
  crontab: ["crontab -e", "crontab -l", "crontab -r"],
  unzip: ["unzip archive.zip -d dest", "unzip -l archive.zip"],
  nc: ["nc -lvnp 4444", "nc -zv host 22"],
  kill: ["kill -9 1234", "kill -15 4321"],
  xargs: ["xargs -0 -I{} rm {}", "xargs -n1 -P4 echo"],
  head: ["head -n 20 file.txt", "head -c 100 file.bin"],
  tail: ["tail -f -n 100 log.txt"],
  sort: ["sort -k2 -n -r data.txt", "sort -u -f names.txt"],
  uniq: ["uniq -c sorted.txt", "sort names.txt | uniq -d"],
  tee: ["ls | tee files.txt", "make 2>&1 | tee -a build.log"],
  diff: ["diff -u old.txt new.txt", "diff -r dir1/ dir2/"],
  gzip: ["gzip -k big.log", "gzip -d archive.gz"],
  column: ["column -t -s, data.csv", "mount | column -t"],
  cut: ["cut -d, -f1 data.csv", "cut -c1-10 file.txt"],
  tr: ["tr -d '\\n'", "tr -s ' '"],
  wc: ["wc -l file.txt", "wc -w -c file.txt"],
  cat: ["cat -n file.txt", "cat -A file.txt"],
  du: ["du -sh dir", "du -ah ."],
  df: ["df -h", "df -T -i"],
  ping: ["ping -c 4 host", "ping -i 2 host"],
  dd: ["dd if=/dev/zero of=out.img bs=1M count=10"],
  make: ["make -j4 -C build", "make -f Makefile.dev -n"],
  pip: ["pip install -U -r requirements.txt", "pip install -e . --no-cache-dir"],
  python: ["python -m venv .venv", "python -u -c 'print(1)'"],
  go: ["go build -o bin/app -race ./...", "go test -run TestFoo -count 1 ./...", "go mod tidy"],
  cargo: ["cargo build --release", "cargo test --workspace --all-features", "cargo add serde --features derive"],
  gcloud: ["gcloud compute instances list --project my-proj --zone us-central1-a", "gcloud storage cp ./dist gs://my-bucket --recursive"],
  terraform: ["terraform apply -auto-approve -var-file=prod.tfvars", "terraform plan -out plan.tfplan -no-color"],
  gh: ["gh pr create --title 'fix' --body 'closes #1'", "gh repo clone owner/name", "gh api repos/owner/name --jq .stargazers_count"],
  yarn: ["yarn add -D typescript", "yarn install --frozen-lockfile"],
  pnpm: ["pnpm add -D vitest", "pnpm install --frozen-lockfile", "pnpm -r run build"],
  zip: ["zip -r archive.zip src -x '*.log'", "zip -9 -j out.zip a.txt b.txt"],
  sudo: ["sudo -u postgres psql", "sudo -i"],
  touch: ["touch newfile.txt", "touch -c -m existing.log"],
  less: ["less -N server.log", "less -S -R output.txt"],
  date: ["date -u", 'date -d "next friday"'],
  echo: ["echo -n hello", "echo -e 'a\\tb'"],
  printf: ["printf '%s\\n' hello", 'printf "%-10s %d\\n" name 42'],
  base64: ["base64 secret.bin", "base64 -d encoded.txt"],
  env: ["env", "env -u DEBUG node app.js"],
  dig: ["dig example.com", "dig -t MX example.com"],
  watch: ["watch -n 10 date", "watch -d ls"],
  uname: ["uname -a", "uname -srm"],
  sha256sum: ["sha256sum file.iso", "sha256sum -c SHASUMS256.txt"],
  free: ["free -h", "free -m -s 5"],
  top: ["top", "top -b -n 1"],
  mount: ["mount", "mount -t ext4 -o ro /dev/sdb1 /mnt"],
  umount: ["umount /mnt", "umount -l /mnt/nfs", "umount -a -t nfs"],
  which: ["which python", "which -a node"],
  whoami: ["whoami"],
  hostname: ["hostname", "hostname -I", "hostname -f"],
  ifconfig: ["ifconfig", "ifconfig -a", "ifconfig eth0"],
  "ssh-keygen": ["ssh-keygen -t ed25519 -C you@example.com", "ssh-keygen -R oldhost", "ssh-keygen -y -f id_rsa"],
  stat: ["stat file.txt", "stat -L link", "stat -t /etc/hosts"],
  file: ["file /bin/ls", "file -i document.pdf", "file -b image.png"],
  basename: ["basename /usr/bin/sort", "basename -s .txt notes.txt", "basename -a src/a.c src/b.c"],
  dirname: ["dirname /usr/bin/sort"],
  realpath: ["realpath ./file.txt", "realpath -m /a/b/missing", "realpath --relative-to /home /home/user/x"],
  md5sum: ["md5sum file.iso", "md5sum -c MD5SUMS"],
  tree: ["tree -L 2 src", "tree -a -d", "tree -h --du"],
  htop: ["htop", "htop -u postgres", "htop -t"],
  pkill: ["pkill -f node", "pkill -9 chrome", "pkill -u www-data"],
  killall: ["killall firefox", "killall -9 node", "killall -u alice"],
  sleep: ["sleep 5", "sleep 0.5"],
  timeout: ["timeout 10 ./run.sh", "timeout -s KILL 30 python job.py", "timeout -k 5 60 make"],
  seq: ["seq 1 10", "seq -s, 0 2 20", "seq -w 1 100"],
  nohup: ["nohup ./server &", "nohup python app.py > out.log 2>&1 &"],
  nslookup: ["nslookup example.com", "nslookup -type=MX example.com"],
  traceroute: ["traceroute example.com", "traceroute -n -m 20 1.1.1.1", "traceroute -T -p 443 host"],
  sha1sum: ["sha1sum file.iso", "sha1sum -c SHA1SUMS"],
  xz: ["xz -9 big.log", "xz -dk archive.xz", "xz -T0 data.tar"],
  bzip2: ["bzip2 -k big.log", "bzip2 -d archive.bz2"],
  paste: ["paste a.txt b.txt", "paste -d, cols1 cols2", "paste -s -d, list.txt"],
  comm: ["comm a.txt b.txt", "comm -12 sorted1 sorted2", "comm -23 a b"],
  nl: ["nl file.txt", "nl -ba src.c", "nl -w4 -s': ' notes.txt"],
  tac: ["tac log.txt", "tac -s, data.csv"],
  rev: ["rev file.txt", "echo hello | rev"],
  "ssh-copy-id": ["ssh-copy-id user@host", "ssh-copy-id -i ~/.ssh/id_ed25519.pub -p 2222 user@host"],
  sftp: ["sftp user@host", "sftp -P 2222 -i key user@host", "sftp -b batch.txt user@host"],
  vim: ["vim notes.txt", "vim -R config.yml", "vim -d old.txt new.txt", "vim -O a.py b.py"],
  nano: ["nano file.txt", "nano -l main.c", "nano -w /etc/hosts"],
  man: ["man ls", "man -k compress", "man 5 crontab", "man -f printf"],
  id: ["id", "id -u", "id -un", "id -Gn alice"],
  who: ["who", "who -a", "who -b", "who -q"],
  uptime: ["uptime", "uptime -p", "uptime -s"],
  su: ["su", "su - alice", "su -c 'systemctl restart nginx'", "su -s /bin/bash postgres"],
  gpg: ["gpg -c secrets.txt", "gpg -e -r alice@example.com report.pdf", "gpg -d secrets.txt.gpg", "gpg --list-keys"],
  tmux: ["tmux new -s work", "tmux attach -t work", "tmux ls", "tmux kill-session -t work"],
  lsblk: ["lsblk", "lsblk -f", "lsblk -p", "lsblk -o NAME,SIZE,MOUNTPOINT"],
  dmesg: ["dmesg", "dmesg -H", "dmesg -w", "dmesg -l err,warn"],
  mktemp: ["mktemp", "mktemp -d", "mktemp -p /var/tmp", "mktemp --suffix=.json"],
  gunzip: ["gunzip archive.gz", "gunzip -k data.gz", "gunzip -c logs.gz | less"],
  history: ["history", "history 20", "history -c", "history -w"],
  alias: ["alias", "alias ll='ls -la'", "alias -p"],
  export: ["export PATH=$PATH:/opt/bin", "export EDITOR=vim", "export -p"]
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
  if (/^\s*(?:\{\s*)?print\s*\$0?\s*(?:\}\s*)?$/.test(tok)) {
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
  const hadDash = tok.startsWith("-");
  let s = tok.replace(/^-/, "");
  if (s === "") return null;
  s = s.replace(/^SIG/i, "").toUpperCase();
  if (/^\d+$/.test(s)) {
    if (!hadDash) return null;
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

// src/danger.ts
var SHELLS = /* @__PURE__ */ new Set(["sh", "bash", "zsh", "dash", "ksh", "fish", "ash"]);
var DOWNLOADERS = /* @__PURE__ */ new Set(["curl", "wget", "fetch"]);
var DEVICE_RE = /^\/dev\/(sd[a-z]|nvme\d|hd[a-z]|vd[a-z]|disk\d|mmcblk\d)/;
function flagsOf(seg) {
  const s = /* @__PURE__ */ new Set();
  for (const tok of seg.tokens) {
    if (tok.kind === "shortFlag") {
      if (tok.bundle) for (const l of tok.bundle) s.add("-" + l);
      else s.add(tok.text.replace(/=.*/, ""));
    } else if (tok.kind === "longFlag") {
      s.add(tok.text.replace(/=.*/, ""));
    }
  }
  return s;
}
function operandsOf(seg) {
  return seg.tokens.filter((t) => t.kind === "operand").map((t) => t.text);
}
function effectiveCommand(seg) {
  if (seg.command !== "sudo" && seg.command !== "env") return seg.command;
  const ops = operandsOf(seg);
  return ops.length ? ops[0].replace(/.*\//, "") : seg.command;
}
function runsShell(seg) {
  const base = (seg.command ?? "").replace(/.*\//, "");
  if (SHELLS.has(base)) return true;
  if (base === "sudo" || base === "env") {
    for (const op of operandsOf(seg)) {
      if (SHELLS.has(op.replace(/.*\//, ""))) return true;
    }
  }
  return false;
}
function precedingSeparators(parsed) {
  const seps = [];
  let pending = null;
  let seenCommandInSeg = false;
  for (const tok of parsed.tokens) {
    if (tok.kind === "pipe" || tok.kind === "operator") {
      pending = tok.text;
      seenCommandInSeg = false;
      continue;
    }
    if (tok.kind === "command" && !seenCommandInSeg) {
      seps.push(pending);
      pending = null;
      seenCommandInSeg = true;
    }
  }
  return seps;
}
function analyzeDangers(parsed) {
  const warnings = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (w) => {
    const key = w.level + "|" + w.title;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(w);
  };
  const raw = parsed.raw;
  if (/\b\w+\s*\(\)\s*\{\s*[^}]*\|\s*\w+\s*&\s*[^}]*\}\s*;/.test(raw) || /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/.test(raw.replace(/\s+/g, ""))) {
    add({
      level: "danger",
      title: "Fork bomb",
      detail: "Recursively spawns processes until the machine runs out of resources and hangs."
    });
  }
  {
    const exprRe = /\$\{\{\s*([^}]*?)\s*\}\}/g;
    const UNTRUSTED = /github\.head_ref|github\.event\.(issue|pull_request|discussion)\.(title|body)|github\.event\.pull_request\.head\.(ref|label)|github\.event\.pull_request\.head\.repo\.(default_branch|description|homepage)|github\.event\.comment\.body|github\.event\.review(_comment)?\.body|github\.event\.commits|github\.event\.head_commit\.(message|author)|github\.event\.pages|github\.event\.workflow_run\.(head_branch|display_title)/;
    let m;
    let sawExpr = false;
    let sawUntrusted = false;
    while ((m = exprRe.exec(raw)) !== null) {
      sawExpr = true;
      if (UNTRUSTED.test(m[1])) sawUntrusted = true;
    }
    if (sawUntrusted) {
      add({
        level: "danger",
        title: "CI expression injection",
        detail: 'A ${{ \u2026 }} expression that can carry attacker-controlled text (a PR/issue title or body, branch name, or commit message) is spliced into this command before the shell runs it \u2014 a crafted value can inject arbitrary commands. Pass it through an environment variable and quote it ("$VAR") instead of inlining it.'
      });
    } else if (sawExpr) {
      add({
        level: "caution",
        title: "CI expression interpolation",
        detail: 'A ${{ \u2026 }} template expression is substituted into this command by the CI runner before the shell parses it. If its value is user-influenced, pass it via an environment variable referenced as "$VAR" rather than inlining it, to avoid shell injection.'
      });
    }
  }
  const seps = precedingSeparators(parsed);
  const commandSegs = parsed.segments.filter((s) => s.command);
  let sawDownloader = false;
  commandSegs.forEach((seg, i) => {
    const base = (seg.command ?? "").replace(/.*\//, "");
    if (DOWNLOADERS.has(base)) sawDownloader = true;
    else if (sawDownloader && runsShell(seg) && seps[i] === "|") {
      add({
        level: "danger",
        title: "Runs downloaded code unread",
        detail: "Pipes a file fetched from the network straight into a shell \u2014 you execute whatever the server sends, sight unseen."
      });
    }
  });
  for (const seg of parsed.segments) {
    const base = (seg.command ?? "").replace(/.*\//, "");
    const eff = (effectiveCommand(seg) ?? "").replace(/.*\//, "");
    const flags = flagsOf(seg);
    const ops = operandsOf(seg);
    if (base === "sudo") {
      add({
        level: "caution",
        title: "Runs as root",
        detail: "Executes with superuser privileges \u2014 a mistake here can affect the whole system."
      });
    }
    if (eff === "rm") {
      const recursive = flags.has("-r") || flags.has("-R") || flags.has("--recursive");
      const force = flags.has("-f") || flags.has("--force");
      const noPreserve = flags.has("--no-preserve-root");
      const targets = ops.filter((o) => o !== "sudo" && o !== "rm");
      const hitsRoot = targets.some(
        (t) => /^\/$|^\/\*|^~\/?$|^\$HOME\/?$|^\/(bin|etc|usr|var|boot|lib|home|root|dev|sys|proc)\b/.test(t) || t === "*" || t === "." || t === ".." || t === "./*"
      );
      if (noPreserve) {
        add({
          level: "danger",
          title: "Disables the / safety guard",
          detail: "--no-preserve-root removes the check that normally stops rm from wiping the entire root filesystem."
        });
      }
      if (recursive && force) {
        add({
          level: "danger",
          title: hitsRoot ? "Wipes critical paths, no prompt" : "Recursive force-delete",
          detail: hitsRoot ? "Recursively force-deletes system-critical paths with no confirmation and no recovery." : "Recursively deletes directories without any confirmation \u2014 there is no undo and no trash."
        });
      } else if (recursive) {
        add({ level: "caution", title: "Recursive delete", detail: "Deletes whole directory trees \u2014 double-check the target path." });
      } else if (force) {
        add({ level: "caution", title: "Forced delete", detail: "Deletes without prompting, even for write-protected files." });
      }
    }
    if (eff === "dd") {
      const toDevice = ops.some((o) => /^of=\/dev\//.test(o));
      if (toDevice) {
        add({
          level: "danger",
          title: "Raw write to a disk device",
          detail: "dd writes bytes directly to a device (of=/dev/\u2026), overwriting everything on that disk with no confirmation."
        });
      }
    }
    if (/^mkfs(\.|$)/.test(eff)) {
      add({ level: "danger", title: "Formats a filesystem", detail: "Creates a new filesystem on the target, erasing all data currently on it." });
    }
    if (eff === "chmod") {
      const world = ops.some((o) => /(^|=)7?77$|^0?777$/.test(o) || /[ugoa]*\+.*w/.test(o) && /o/.test(o));
      const perm777 = ops.some((o) => /^0?777$/.test(o));
      if (perm777 || world) {
        const recursive = flags.has("-R") || flags.has("--recursive");
        add({
          level: "caution",
          title: recursive ? "World-writable, recursively" : "World-writable permissions",
          detail: "Grants read/write/execute to every user on the machine \u2014 a common security misconfiguration."
        });
      }
    }
    if (eff === "chown" && (flags.has("-R") || flags.has("--recursive"))) {
      add({ level: "caution", title: "Recursive ownership change", detail: "Reassigns ownership of an entire tree \u2014 easy to lock yourself out of files if the path is wrong." });
    }
    if (eff === "git") {
      const sub = ops[0];
      if (sub === "push" && (flags.has("-f") || flags.has("--force") || flags.has("--force-with-lease"))) {
        add({ level: "caution", title: "Force-push", detail: "Overwrites the remote branch history \u2014 can destroy commits other people rely on." });
      }
      if (sub === "reset" && flags.has("--hard")) {
        add({ level: "caution", title: "Hard reset", detail: "Discards all uncommitted changes in the working tree \u2014 they cannot be recovered." });
      }
      if (sub === "clean" && (flags.has("-f") || flags.has("--force"))) {
        add({ level: "caution", title: "Deletes untracked files", detail: "git clean permanently removes untracked files and directories." });
      }
    }
    if (["shutdown", "reboot", "halt", "poweroff"].includes(eff)) {
      add({ level: "caution", title: "Changes machine power state", detail: "Shuts down or restarts the system \u2014 active sessions and unsaved work are lost." });
    }
    if (eff === "eval") {
      add({ level: "caution", title: "Evaluates a built string", detail: "Runs an assembled string as a command \u2014 dangerous if any part comes from untrusted input." });
    }
    const toks = seg.tokens;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.kind === "redirect" && (t.text === ">" || t.text === ">>" || t.text === "&>")) {
        const target = toks[i + 1]?.text ?? "";
        if (DEVICE_RE.test(target)) {
          add({ level: "danger", title: "Writes onto a disk device", detail: `Redirects output straight to ${target}, corrupting whatever is stored there.` });
        }
      }
    }
  }
  return warnings;
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
        if (tok.text.includes("=")) {
          const namePart = tok.text.split("=")[0];
          const g2 = flagGloss(info, namePart);
          if (g2) {
            add(tok.text, g2, ti, "db");
            break;
          }
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
        if (sawSubcommand && currentSub && operandCount === 0 && info?.subSubcommands?.[currentSub]?.[tok.text]) {
          add(tok.text, info.subSubcommands[currentSub][tok.text], ti, "db");
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
  return { raw, parsed, lines, warnings: analyzeDangers(parsed) };
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
  const glossBottom = glossTop + res.lines.length * rowH;
  const DANGER = "#ff7b72";
  const CAUTION = "#f2cc60";
  let riskSvg = "";
  let riskHeight = 0;
  if (res.warnings.length) {
    const warnRowH = 30;
    const panelPadTop = 22;
    const headH = 30;
    const panelH = headH + res.warnings.length * warnRowH + 18;
    const panelY = glossBottom + panelPadTop;
    riskHeight = panelPadTop + panelH;
    const warnRows = res.warnings.map((w, i) => {
      const y = panelY + headH + 6 + i * warnRowH;
      const col = w.level === "danger" ? DANGER : CAUTION;
      const icon = w.level === "danger" ? "\u26A0" : "\u25B3";
      return `<text x="${PADX + 8}" y="${y}" fill="${col}" font-size="17" font-weight="700">${icon} ${esc(w.title)}</text><text x="${PADX + 8 + (w.title.length + 3) * 10.4}" y="${y}" fill="${MUTED}" font-size="16">${esc(w.detail)}</text>`;
    }).join("");
    riskSvg = `<rect x="16" y="${panelY}" width="${width - 32}" height="${panelH}" rx="10" fill="#1c1512" stroke="#5a2d2a"/><text x="${PADX + 8}" y="${panelY + 22}" fill="${DANGER}" font-size="14" font-weight="700" letter-spacing="1">\u26A0 RISK</text>` + warnRows;
  }
  const height = glossBottom + riskHeight + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
  <rect width="${width}" height="${height}" rx="16" fill="${BG}"/>
  <rect x="16" y="16" width="${width - 32}" height="84" rx="10" fill="${PANEL}" stroke="${BORDER}"/>
  <circle cx="40" cy="42" r="6" fill="#ff5f56"/><circle cx="60" cy="42" r="6" fill="#ffbd2e"/><circle cx="80" cy="42" r="6" fill="#27c93f"/>
  <text x="${width - 28}" y="46" text-anchor="end" fill="${MUTED}" font-size="14">offline</text>
  ${cmdParts.join("")}
  <line x1="${PADX}" y1="${glossTop - 26}" x2="${width - PADX}" y2="${glossTop - 26}" stroke="${BORDER}"/>
  ${rows}
  ${riskSvg}
  <text x="${PADX}" y="${height - 16}" fill="${MUTED}" font-size="14">explained locally \xB7 <tspan fill="${FG}">${esc(brand)}</tspan></text>
</svg>`;
}
function estimateWidth(res) {
  let maxGloss = 0;
  for (const ln of res.lines) maxGloss = Math.max(maxGloss, ln.gloss.length);
  const cmdLen = res.raw.length * 15.5 + 80;
  const glossWidth = 220 + 34 + maxGloss * 9.6 + 40;
  let warnWidth = 0;
  for (const w of res.warnings) {
    warnWidth = Math.max(warnWidth, (w.title.length + 3) * 10.4 + w.detail.length * 8.8 + 60);
  }
  return Math.ceil(Math.max(cmdLen, glossWidth, warnWidth));
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
  let risk = "";
  if (res.warnings.length) {
    const RED = "\x1B[38;5;203m";
    const YEL = "\x1B[38;5;221m";
    const BOLD = "\x1B[1m";
    const paint = (w) => {
      const col = w.level === "danger" ? RED : YEL;
      const icon = w.level === "danger" ? "\u26A0" : "\u25B3";
      const label = w.level === "danger" ? "DANGER" : "caution";
      if (!color) return `  ${icon} ${label}  ${w.title} \u2014 ${w.detail}`;
      return `  ${col}${BOLD}${icon} ${label}${RESET}  ${col}${w.title}${RESET} ${dim("\u2014 " + w.detail)}`;
    };
    const head = color ? `  ${DIM}risk${RESET}` : "  risk";
    risk = "\n" + head + "\n" + res.warnings.map(paint).join("\n") + "\n";
  }
  return `
  ${cmdLine}

${rows}
${risk}
  ${dim("explained locally \xB7 cmdxray")}
`;
}

// src/json.ts
var JSON_SCHEMA_VERSION = 1;
function cleanToken(t) {
  const out = { text: t.text, kind: t.kind };
  if (t.bundle && t.bundle.length) out.bundle = t.bundle;
  if (t.quoted) out.quoted = true;
  return out;
}
function toJsonReport(res) {
  const risk = res.warnings.some((w) => w.level === "danger") ? "danger" : res.warnings.some((w) => w.level === "caution") ? "caution" : "none";
  return {
    tool: "cmdxray",
    schemaVersion: JSON_SCHEMA_VERSION,
    command: res.raw,
    risk,
    tokens: res.parsed.tokens.map(cleanToken),
    segments: res.parsed.segments.map((s) => ({
      command: s.command,
      tokens: s.tokens.map(cleanToken)
    })),
    explanations: res.lines.map((l) => ({
      token: l.token,
      gloss: l.gloss,
      source: l.source,
      tokenIndex: l.tokenIndex
    })),
    warnings: res.warnings.map((w) => ({
      level: w.level,
      title: w.title,
      detail: w.detail
    }))
  };
}

// src/batch.ts
function commandOf(item) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && typeof item.command === "string") {
    return item.command;
  }
  return null;
}
function runBatch(input, opts = {}) {
  let arr;
  try {
    arr = JSON.parse(input);
  } catch (e) {
    throw new Error("cmdxray --batch-json: stdin is not valid JSON \u2014 expected a JSON array of command strings. " + e.message);
  }
  if (!Array.isArray(arr)) {
    throw new Error("cmdxray --batch-json: expected a JSON array of command strings on stdin, got " + (arr === null ? "null" : typeof arr) + ".");
  }
  return arr.map((item) => {
    const command = commandOf(item);
    if (command == null) {
      return { command: null, error: "each item must be a command string, or an object with a string `command` field" };
    }
    try {
      return toJsonReport(explain(command.trim(), opts));
    } catch (e) {
      return { command, error: e.message };
    }
  });
}
export {
  DB,
  EXAMPLES,
  GENERIC_FLAGS,
  JSON_SCHEMA_VERSION,
  analyzeDangers,
  explain,
  parseCommand,
  renderHtml,
  renderSvg,
  renderTerminal,
  runBatch,
  toJsonReport
};
