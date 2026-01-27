import { NextResponse } from 'next/server';


const INSTALL_SCRIPT = `#!/bin/bash
# Skills Hot CLI Installer
# Usage: curl -fsSL https://skills.hot/install.sh | bash

set -e

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
INSTALL_DIR="\${HOME}/.local/bin"
BINARY_NAME="shot"
GITHUB_REPO="yan-labs/skills-hot"
VERSION="\${1:-latest}"

# Detect OS and Architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    case "$OS" in
        darwin)
            OS="darwin"
            ;;
        linux)
            OS="linux"
            ;;
        mingw*|msys*|cygwin*)
            echo -e "\${RED}Error: Windows detected. Please use install.ps1 instead.\${NC}"
            echo "Run: irm https://skills.hot/install.ps1 | iex"
            exit 1
            ;;
        *)
            echo -e "\${RED}Error: Unsupported operating system: $OS\${NC}"
            exit 1
            ;;
    esac

    case "$ARCH" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            echo -e "\${RED}Error: Unsupported architecture: $ARCH\${NC}"
            exit 1
            ;;
    esac

    PLATFORM="\${OS}-\${ARCH}"
    echo -e "\${BLUE}Detected platform: \${PLATFORM}\${NC}"
}

# Get latest version from GitHub
get_latest_version() {
    if [ "$VERSION" = "latest" ]; then
        VERSION=$(curl -fsSL "https://api.github.com/repos/\${GITHUB_REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\\1/')
        if [ -z "$VERSION" ]; then
            echo -e "\${YELLOW}Warning: Could not fetch latest version, using 'latest'\${NC}"
            VERSION="latest"
        fi
    fi
    echo -e "\${BLUE}Installing version: \${VERSION}\${NC}"
}

# Download and install binary
install_binary() {
    local BINARY_URL="https://github.com/\${GITHUB_REPO}/releases/download/\${VERSION}/shot-\${PLATFORM}.tar.gz"

    echo -e "\${BLUE}Downloading Skills Hot CLI...\${NC}"
    echo "  URL: \${BINARY_URL}"

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT

    # Download and extract
    if command -v curl &> /dev/null; then
        curl -fsSL "$BINARY_URL" -o "\${TEMP_DIR}/shot.tar.gz"
    elif command -v wget &> /dev/null; then
        wget -q "$BINARY_URL" -O "\${TEMP_DIR}/shot.tar.gz"
    else
        echo -e "\${RED}Error: curl or wget is required\${NC}"
        exit 1
    fi

    # Extract
    tar -xzf "\${TEMP_DIR}/shot.tar.gz" -C "\${TEMP_DIR}"

    # Find and move binary
    EXTRACTED_BINARY=$(find "\${TEMP_DIR}" -name "shot*" -type f | head -1)
    if [ -z "$EXTRACTED_BINARY" ]; then
        echo -e "\${RED}Error: Binary not found in archive\${NC}"
        exit 1
    fi

    mv "$EXTRACTED_BINARY" "\${INSTALL_DIR}/\${BINARY_NAME}"
    chmod +x "\${INSTALL_DIR}/\${BINARY_NAME}"

    echo -e "\${GREEN}Binary installed to: \${INSTALL_DIR}/\${BINARY_NAME}\${NC}"
}

# Add to PATH if needed
setup_path() {
    if [[ ":\$PATH:" == *":\$INSTALL_DIR:"* ]]; then
        return
    fi

    echo -e "\${YELLOW}Adding \${INSTALL_DIR} to PATH...\${NC}"

    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        bash) PROFILE="\${HOME}/.bashrc" ;;
        zsh)  PROFILE="\${HOME}/.zshrc" ;;
        fish) PROFILE="\${HOME}/.config/fish/config.fish" ;;
        *)    PROFILE="\${HOME}/.profile" ;;
    esac

    if [ -f "$PROFILE" ]; then
        if ! grep -q "\\.local/bin" "$PROFILE"; then
            echo "" >> "$PROFILE"
            echo "# Skills Hot CLI" >> "$PROFILE"
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$PROFILE"
            echo -e "\${GREEN}Added to $PROFILE\${NC}"
        fi
    fi
}

# Verify installation
verify_installation() {
    if [ -x "\${INSTALL_DIR}/\${BINARY_NAME}" ]; then
        echo ""
        echo -e "\${GREEN}========================================\${NC}"
        echo -e "\${GREEN} Skills Hot CLI (shot) installed!        \${NC}"
        echo -e "\${GREEN}========================================\${NC}"
        echo ""
        echo "To get started:"
        echo ""
        echo -e "  \${BLUE}source ~/.bashrc\${NC}  # or restart your terminal"
        echo -e "  \${BLUE}shot --help\${NC}"
        echo ""
        echo "Quick start:"
        echo ""
        echo -e "  \${BLUE}shot search git\${NC}     # Search for skills"
        echo -e "  \${BLUE}shot add git-commit\${NC} # Install a skill"
        echo -e "  \${BLUE}shot login\${NC}          # Login to your account"
        echo ""
    else
        echo -e "\${RED}Installation failed.\${NC}"
        exit 1
    fi
}

# Main
main() {
    echo ""
    echo -e "\${BLUE}╔═══════════════════════════════════════╗\${NC}"
    echo -e "\${BLUE}║     Skills Hot CLI (shot)               ║\${NC}"
    echo -e "\${BLUE}║     https://skills.hot             ║\${NC}"
    echo -e "\${BLUE}╚═══════════════════════════════════════╝\${NC}"
    echo ""

    detect_platform
    get_latest_version
    install_binary
    setup_path
    verify_installation
}

main "$@"
`;

export async function GET() {
  return new NextResponse(INSTALL_SCRIPT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="install.sh"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
