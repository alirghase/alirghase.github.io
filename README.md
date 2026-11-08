# alirghase.github.io

My professional site: the products I've built, write-ups of what I measured, and notes on
system design and technical problems.

- The pages are written as Obsidian notes. `publish.sh` copies them into `content/`, scans them for
  anything private, builds the site with `build.mjs` and pushes.
- GitHub Actions builds and deploys to GitHub Pages on every push to `main`.
