# DevProxy Distribution Guide

This guide covers how to package and distribute DevProxy for other developers.

## Before Publishing

1. **Bump version**:
   - Update `version` in `package.json`
   - Update `version` in `Formula/devproxy.rb`

2. **Test a fresh clone**:
   ```bash
   cd /tmp
   git clone https://github.com/readf/DevProxy.git devproxy-test
   cd devproxy-test
   bash scripts/setup.sh
   ```
   Visit `https://proxy.local` and verify the dashboard loads.

3. **Update CHANGELOG** (optional):
   ```bash
   git log --oneline <prev-tag>..HEAD > CHANGELOG_DRAFT.txt
   ```

4. **Commit changes**:
   ```bash
   git add package.json Formula/devproxy.rb CHANGELOG.md
   git commit -m "Release: v1.0.0"
   ```

## Publishing

### GitHub Release

1. Tag the commit:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. Create a GitHub release:
   - Go to [Releases](https://github.com/readf/DevProxy/releases)
   - Click "Create a new release"
   - Select your tag
   - Add release notes from `CHANGELOG.md`
   - Publish

### Homebrew

1. In your Homebrew tap repository (e.g., `homebrew-devproxy`):
   ```bash
   cd ~/homebrew-devproxy
   ```

2. Get the **SHA256** of the release tarball:
   ```bash
   curl -sL https://github.com/readf/DevProxy/archive/v1.0.0.tar.gz | shasum -a 256
   ```

3. Update `Formula/devproxy.rb`:
   ```ruby
   url "https://github.com/readf/DevProxy/archive/v1.0.0.tar.gz"
   sha256 "<output-from-above>"
   version "1.0.0"
   ```

4. Test the formula locally:
   ```bash
   brew install --build-from-source ./Formula/devproxy.rb
   devproxy start
   ```

5. Commit and push to tap:
   ```bash
   git add Formula/devproxy.rb
   git commit -m "devproxy v1.0.0"
   git push origin main
   ```

6. Users can now install via:
   ```bash
   brew tap readf/DevProxy
   brew install devproxy
   devproxy start
   ```

### Docker Hub (Optional)

To also publish the Docker image:

1. Build the image tagged with version:
   ```bash
   docker build -t readf/DevProxy:1.0.0 -t readf/DevProxy:latest .
   ```

2. Push to Docker Hub:
   ```bash
   docker push readf/DevProxy:1.0.0
   docker push readf/DevProxy:latest
   ```

3. Users can pull with:
   ```bash
   docker pull readf/DevProxy:latest
   ```

## Continuous Integration Setup

The `.github/workflows/release.yml` file includes a template for automating GitHub releases. To enable:

1. Go to your GitHub repository → Settings → Actions
2. Confirm workflows are enabled
3. When you push a tag (`git push origin v1.0.0`), the workflow will trigger
4. Update `Formula/devproxy.rb` and push to your Homebrew tap

## Troubleshooting

- **Users cannot install via Homebrew**: Confirm the tap is public and the formula syntax is correct (`brew audit --online readf/DevProxy/formula/devproxy.rb`).
- **Docker image not pulling**: Ensure your Docker Hub account is public or users have appropriate credentials.
- **Setup script fails on fresh clone**: Verify all scripts are executable (`chmod +x scripts/*.sh`).
- **Users report Docker socket errors on start/stop/logs**: DevProxy now prints a friendly preflight message when Docker is unavailable. In release testing, verify `devproxy start`, `devproxy stop`, and `devproxy logs` show actionable output when Docker Desktop is stopped.
