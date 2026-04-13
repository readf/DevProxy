# Contributing to DevProxy

Thanks for your interest in contributing! Here's how to help:

## Reporting Issues

- Check [existing issues](https://github.com/fredread/devproxy/issues) first.
- Describe the problem clearly: what you did, what happened, what you expected.
- Include:
  - macOS version
  - Docker Desktop version
  - Output of `docker compose ps` and `docker compose logs devproxy`

## Submitting Changes

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Make your changes.
4. Test your changes:
   ```bash
   bash scripts/stop-proxy.sh  # if running
   bash scripts/start-proxy.sh
   ```
5. Commit with clear messages: `git commit -m "Add feature: description"`.
6. Push to your fork and open a pull request.

## Code Style

- Bash scripts: Keep it simple, avoid platform-specific features.
- Node.js: Use standard ES modules; avoid dependencies when possible.
- Comments: Explain *why*, not just *what*.

## Testing

- Test `bash scripts/start-proxy.sh` on a fresh environment (or with mappings cleared).
- Test the dashboard at `https://proxy.local`.
- Test adding/editing/removing mappings via the UI.
- Verify mDNS publishers are active: `pids=$(paste -sd, state/mdns-pids) && ps -p "$pids" -o pid,command`.

## Questions?

Open an issue or discussion. We appreciate all feedback!
