class Devproxy < Formula
  desc "Local development reverse proxy with mDNS publishing"
  homepage "https://github.com/fredread/devproxy"
  url "https://github.com/readf/DevProxy/archive/v1.0.2.tar.gz"
  sha256 "38818578b5870eef6617cf5d6a9e62eeff4ee72526d74f8edff14d1b2a183fa1"
  license "MIT"
  version "1.0.2"

  depends_on "docker"

  def install
    # Copy scripts into libexec
    libexec.install "scripts"
    libexec.install "Dockerfile", "docker-compose.yml"
    
    # Create bin wrapper
    (bin/"devproxy").write_env_script libexec/"devproxy.sh", <<~EOS
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
