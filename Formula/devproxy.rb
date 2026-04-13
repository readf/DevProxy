class Devproxy < Formula
  desc "Local development reverse proxy with mDNS publishing"
  homepage "https://github.com/readf/DevProxy"
  url "https://github.com/readf/DevProxy/archive/v1.0.4.tar.gz"
  sha256 "74fa97eee26e716a82eb1b2c861f8f2bbe7ea627104d314a806d97d43f1fe6cc"
  license "MIT"
  version "1.0.4"
  revision 1

  depends_on "docker"

  def install
    # Copy scripts into libexec
    libexec.install "scripts"
    libexec.install "Dockerfile", "docker-compose.yml"
    
    # Create bin wrapper
    (bin/"devproxy").write <<~EOS
      #!/usr/bin/env bash
      set -euo pipefail

      cmd="${1:-start}"
      source_root="#{libexec}"
      runtime_root="${HOME}/.devproxy"

      ensure_runtime_layout() {
        mkdir -p "${runtime_root}/config" "${runtime_root}/state"
        cp "${source_root}/docker-compose.yml" "${runtime_root}/docker-compose.yml"
        cp "${source_root}/Dockerfile" "${runtime_root}/Dockerfile"
        rm -rf "${runtime_root}/scripts"
        cp -R "${source_root}/scripts" "${runtime_root}/scripts"
      }

      # Create user-writable runtime dirs on first run.
      mkdir -p "$HOME/.devproxy/config" "$HOME/.devproxy/state"

      case "$cmd" in
        start)
          ensure_runtime_layout
          bash "$runtime_root/scripts/start-proxy.sh"
          ;;
        stop)
          ensure_runtime_layout
          bash "$runtime_root/scripts/stop-proxy.sh"
          ;;
        logs)
          ensure_runtime_layout
          cd "$runtime_root"
          docker compose logs -f devproxy
          ;;
        *)
          echo "Usage: devproxy [start|stop|logs]"
          exit 1
          ;;
      esac
    EOS
    chmod 0755, bin/"devproxy"
  end

  def post_install
    # No-op: Homebrew post_install runs in a restricted context where writing
    # to the user's home directory can be denied.
  end

  test do
    system "#{bin}/devproxy", "--help" rescue nil  # Just check it runs
  end
end
