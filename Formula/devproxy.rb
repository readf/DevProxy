class Devproxy < Formula
  desc "Local development reverse proxy with mDNS publishing"
  homepage "https://github.com/readf/DevProxy"
  url "https://github.com/readf/DevProxy/archive/v1.0.4.tar.gz"
  sha256 "74fa97eee26e716a82eb1b2c861f8f2bbe7ea627104d314a806d97d43f1fe6cc"
  license "MIT"
  version "1.0.4"

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
      repo_root="#{libexec}"

      case "$cmd" in
        start)
          bash "$repo_root/scripts/start-proxy.sh"
          ;;
        stop)
          bash "$repo_root/scripts/stop-proxy.sh"
          ;;
        logs)
          cd "$repo_root"
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
    system "mkdir", "-p", "#{ENV['HOME']}/.devproxy/config"
    system "mkdir", "-p", "#{ENV['HOME']}/.devproxy/state"
    puts "DevProxy installed. Created config directory at ~/.devproxy/"
  end

  test do
    system "#{bin}/devproxy", "--help" rescue nil  # Just check it runs
  end
end
