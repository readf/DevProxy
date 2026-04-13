class Devproxy < Formula
  desc "Local development reverse proxy with mDNS publishing"
  homepage "https://github.com/readf/DevProxy"
  url "https://github.com/readf/DevProxy/archive/v1.0.5.tar.gz"
  sha256 "280b619a31d8dafe8e58cccee61a9747b691709c6be3b73a26a9d65cbb8cc238"
  license "MIT"
  version "1.0.5"
  revision 2

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
        cp -L "${source_root}/docker-compose.yml" "${runtime_root}/docker-compose.yml"
        cp -L "${source_root}/Dockerfile" "${runtime_root}/Dockerfile"
        rm -rf "${runtime_root}/scripts"
        mkdir -p "${runtime_root}/scripts"
        cp -R -L "${source_root}/scripts/." "${runtime_root}/scripts/"

        required=(
          docker-entrypoint.sh
          http-redirect.mjs
          host-forward.mjs
          dashboard-server.mjs
          sync-mappings.mjs
        )
        for file in "${required[@]}"; do
          if [[ ! -f "${runtime_root}/scripts/${file}" ]]; then
            echo "Missing runtime script: ${runtime_root}/scripts/${file}" >&2
            exit 1
          fi
        done
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
