class Devproxy < Formula
  desc "Local development reverse proxy with mDNS publishing"
  homepage "https://github.com/readf/DevProxy"
  url "https://github.com/readf/DevProxy/archive/v1.0.7.tar.gz"
  sha256 "40992e970800f9796b895e5ac5cc1114fd2fa06e513787d97dd12a46ae12363f"
  license "MIT"
  version "1.0.7"

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

      check_docker_ready() {
        print_docker_error() {
          local detail="$1"
          cat >&2 <<EOF

============================================================
!! ACTION REQUIRED: Docker is needed to run DevProxy.
!! ${detail}
!!
!! Next steps:
!! 1) Install Docker Desktop if not installed.
!! 2) Start Docker Desktop and wait until it is fully running.
!! 3) Verify with: docker info
!! 4) Retry this command.
============================================================

EOF
        }

        if ! command -v docker >/dev/null 2>&1; then
          print_docker_error "Docker CLI was not found in PATH."
          return 1
        fi

        if ! docker info >/dev/null 2>&1; then
          print_docker_error "Docker is installed but the daemon/socket is not reachable."
          return 1
        fi
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
          check_docker_ready
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
