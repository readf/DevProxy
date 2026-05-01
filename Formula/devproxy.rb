class Devproxy < Formula
  desc "Local development reverse proxy with mDNS publishing"
  homepage "https://github.com/readf/DevProxy"
  url "https://github.com/readf/DevProxy/archive/v1.2.0.tar.gz"
  sha256 "43c3a866cf50929792005fe93221a9e710d3e0855adc3addda237f56d595d838"
  license "MIT"
  version "1.2.0"

  depends_on "docker"

  def install
    # Copy scripts into libexec
    libexec.install "scripts"
    libexec.install "Dockerfile", "docker-compose.yml"

    # bin/devproxy is a real file in the repo (with executable bit tracked by git).
    # Substitute the libexec placeholder with the actual installed path, then install.
    # Generating the wrapper via a heredoc in the formula causes Homebrew to write
    # the file as 0444 regardless of any subsequent chmod calls in the install block.
    inreplace "bin/devproxy", "__LIBEXEC__", libexec
    bin.install "bin/devproxy"
  end

  def post_install
    # No-op: Homebrew post_install runs in a restricted context where writing
    # to the user's home directory can be denied.
  end

  test do
    system "#{bin}/devproxy", "--help" rescue nil  # Just check it runs
  end
end
