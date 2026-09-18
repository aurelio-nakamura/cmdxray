// recipes-data.mjs — curated gallery of the most-searched *specific* command
// invocations (the exact one-liners people paste into Google: "what does
// tar -xzvf do", "chmod 755 meaning", "ps aux explained"). Each page runs the
// SAME curated engine the tool ships (scripts/gen-pages.mjs) to render a live,
// accurate token-by-token breakdown + any risk warnings — nothing is hand-faked.
// The prose (meaning / detail) is hand-written and reviewed for accuracy.
// High-intent, high-search-volume, genuinely useful — each links back to the
// interactive offline explainer so a visitor can tweak the command themselves.

export const RECIPES = [
  {
    slug: "tar-xzvf",
    cmd: "tar -xzvf archive.tar.gz",
    meaning: "Extract a gzip-compressed tarball, listing files as it goes.",
    detail: "The classic 'unzip a .tar.gz' incantation. -x extracts, -z pipes the archive through gzip, -v prints each file (verbose), and -f says the next argument is the archive filename. Order matters only in that -f must come last because it takes the filename.",
  },
  {
    slug: "tar-czvf",
    cmd: "tar -czvf archive.tar.gz myfolder",
    meaning: "Create a new gzip-compressed tarball from a folder.",
    detail: "The mirror image of extraction: -c creates a new archive, -z gzip-compresses it, -v lists files as they're added, and -f names the output file (archive.tar.gz) — everything after it is what to pack.",
  },
  {
    slug: "chmod-755",
    cmd: "chmod 755 script.sh",
    meaning: "Make a file readable and executable by everyone, writable only by its owner.",
    detail: "755 is octal: owner gets 7 (read+write+execute), group and others get 5 (read+execute). It's the standard mode for scripts and directories you want everyone to run or enter but only you to modify.",
  },
  {
    slug: "chmod-x",
    cmd: "chmod +x script.sh",
    meaning: "Add the executable bit so a script can be run directly.",
    detail: "+x turns a plain text file into something you can launch with ./script.sh instead of `bash script.sh`. It adds execute permission for owner, group, and others without touching the read/write bits.",
  },
  {
    slug: "curl-O",
    cmd: "curl -O https://example.com/file.zip",
    meaning: "Download a file and save it under its original remote name.",
    detail: "Capital -O writes the download to a local file named after the last path segment of the URL (file.zip). Lowercase -o would let you choose a different output name. Without either, curl prints the body to your terminal.",
  },
  {
    slug: "grep-r",
    cmd: "grep -r 'TODO' src/",
    meaning: "Search a whole directory tree for a string.",
    detail: "-r walks src/ recursively and prints every line (with filename) that contains TODO. Add -i for case-insensitive, -n to show line numbers, and -l to print only the matching filenames.",
  },
  {
    slug: "ps-aux",
    cmd: "ps aux",
    meaning: "List every running process with its owner, CPU, and memory.",
    detail: "In BSD-style syntax a = all users' processes, u = user-oriented columns (USER, %CPU, %MEM, COMMAND…), x = include processes with no controlling terminal (daemons). The go-to snapshot of everything running; pipe to grep to find one.",
  },
  {
    slug: "find-name",
    cmd: "find . -name '*.log'",
    meaning: "Find files by name pattern under the current directory.",
    detail: "Starts at . (here) and descends every subdirectory, printing paths whose name matches the glob *.log. Quote the pattern so the shell passes it to find literally. Use -iname for case-insensitive matching.",
  },
  {
    slug: "ssh-i",
    cmd: "ssh -i key.pem ubuntu@1.2.3.4",
    meaning: "Connect over SSH using a specific private key file.",
    detail: "-i points at the identity (private key) to authenticate with instead of the default ~/.ssh/id_* keys — common with cloud instances that hand you a .pem file. ubuntu is the remote username; 1.2.3.4 is the host.",
  },
  {
    slug: "rsync-avz",
    cmd: "rsync -avz src/ user@host:/backup/",
    meaning: "Efficiently sync a folder to another machine, copying only changes.",
    detail: "-a archive mode preserves permissions, timestamps, symlinks and recurses; -v is verbose; -z compresses data in transit. The trailing slash on src/ copies the folder's contents into /backup/ rather than nesting a src directory inside it.",
  },
  {
    slug: "ln-s",
    cmd: "ln -s /opt/app/bin/tool /usr/local/bin/tool",
    meaning: "Create a symbolic link (shortcut) pointing at another path.",
    detail: "-s makes a symlink rather than a hard link. The first path is the target it points to; the second is the link to create. Handy for exposing a binary on your PATH without copying it.",
  },
  {
    slug: "kill-9",
    cmd: "kill -9 12345",
    meaning: "Forcibly terminate a process by PID that won't stop otherwise.",
    detail: "-9 sends SIGKILL, which the kernel enforces immediately — the process gets no chance to clean up, flush buffers, or save state. Reach for plain `kill` (SIGTERM) first; use -9 only when a process is truly stuck.",
  },
  {
    slug: "du-sh",
    cmd: "du -sh *",
    meaning: "Show the total size of each item in the current directory.",
    detail: "-s summarises (one total per argument instead of every subfile) and -h prints human-readable sizes (K/M/G). The * expands to each entry here, so you get a tidy size-per-folder list. Add | sort -h to rank them.",
  },
  {
    slug: "ss-tulpn",
    cmd: "ss -tulpn",
    meaning: "List listening TCP/UDP ports and the processes behind them.",
    detail: "The modern replacement for netstat: -t TCP, -u UDP, -l listening sockets only, -p show the owning process, -n numeric (skip DNS/port-name lookups). The one-liner for 'what's listening on this box'.",
  },
  {
    slug: "netstat-tulpn",
    cmd: "netstat -tulpn",
    meaning: "Show listening ports and their processes (classic tool).",
    detail: "-t TCP, -u UDP, -l listening only, -p the owning program, -n numeric addresses/ports. Same intent as `ss -tulpn` on older systems; ss is faster and preferred on modern Linux.",
  },
  {
    slug: "sed-i",
    cmd: "sed -i 's/foo/bar/g' file.txt",
    meaning: "Find-and-replace text in a file, in place.",
    detail: "-i edits file.txt directly instead of printing to stdout. The s/foo/bar/g script substitutes foo with bar, and the trailing g makes it replace every match on each line, not just the first. There's no undo, so back up or use version control.",
  },
  {
    slug: "awk-print-1",
    cmd: "awk '{print $1}' access.log",
    meaning: "Print the first whitespace-separated column of each line.",
    detail: "awk splits every line into fields on whitespace; $1 is the first field, $2 the second, and so on ($0 is the whole line). This prints column one of access.log — a fast way to pull, say, IPs or usernames out of a log.",
  },
  {
    slug: "git-log-oneline",
    cmd: "git log --oneline --graph",
    meaning: "Show compact commit history as an ASCII branch graph.",
    detail: "--oneline condenses each commit to a short hash plus its summary; --graph draws the branch/merge topology to the left with ASCII lines. Add --all to include every branch and --decorate to show tag/branch labels.",
  },
  {
    slug: "tail-f",
    cmd: "tail -f /var/log/syslog",
    meaning: "Stream new lines of a log file as they're written.",
    detail: "-f 'follows' the file: after printing the last lines, tail keeps the file open and prints anything appended, live. The standard way to watch a log while reproducing a bug. Ctrl-C to stop; use -F to survive log rotation.",
  },
  {
    slug: "lsof-i",
    cmd: "lsof -i :8080",
    meaning: "Find which process is using a given network port.",
    detail: "lsof lists open files, and on Unix sockets are files; -i :8080 filters to whatever has port 8080 open. The go-to answer to 'address already in use' — it shows the PID you need to stop.",
  },
  {
    slug: "scp",
    cmd: "scp file.txt user@host:/tmp/",
    meaning: "Copy a file to a remote machine over SSH.",
    detail: "scp uses the SSH protocol to transfer file.txt to /tmp/ on host as user. Swap the arguments to pull a file down instead, and add -r to copy a directory recursively. (rsync is better for large or repeated transfers.)",
  },
  {
    slug: "xargs-rm",
    cmd: "xargs rm < files.txt",
    meaning: "Turn a list of filenames into arguments for a command.",
    detail: "xargs reads whitespace/newline-separated items from stdin and appends them as arguments — here running rm on every path listed in files.txt. Prefer `xargs -0` with `find -print0` when names can contain spaces.",
  },
  {
    slug: "docker-run-it",
    cmd: "docker run -it ubuntu bash",
    meaning: "Start a throwaway container and drop into an interactive shell.",
    detail: "-i keeps stdin open and -t allocates a pseudo-terminal, together giving you an interactive session; ubuntu is the image and bash is the command to run inside it. Add --rm to delete the container automatically when you exit.",
  },
  {
    slug: "dd-image",
    cmd: "dd if=/dev/zero of=disk.img bs=1M count=100",
    meaning: "Create a 100 MB file filled with zero bytes.",
    detail: "dd copies blocks from if (input file) to of (output file); reading /dev/zero writes zeros, bs=1M sets a 1-megabyte block size and count=100 copies 100 of them → a 100 MB file. Double-check of= — pointed at a disk device, dd overwrites it irrecoverably.",
  },
];
