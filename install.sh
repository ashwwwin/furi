#!/usr/bin/env bash

# Exit immediately if any command fails and enable error tracing
set -o errexit
set -o pipefail

# Text formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
ITALIC='\033[3m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Configuration
FURIKAKE_DIR="${HOME}/.furikake"
BIN_DIR="${HOME}/.local/bin"
REPO_OWNER="ashwwwin"
REPO_NAME="furi"
REPO_BRANCH="main"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}"

# Progress bar variables
STEPS=6
current_step=0
progress_bar_width=40
TEMP_DIR=""
SHELL_CONFIG=""

cleanup() {
  if [ -n "${TEMP_DIR}" ] && [ -d "${TEMP_DIR}" ]; then
    rm -rf "${TEMP_DIR}" &>/dev/null || true
  fi
  
  if [ $? -ne 0 ] && [ ${current_step} -lt ${STEPS} ]; then
    echo -e "\n${RED}${BOLD}⨯ Installation was interrupted. Please try again.${NC}"
  fi
}

trap cleanup EXIT

show_progress() {
  if [ $current_step -eq 0 ]; then
    current_step=1
  else
    current_step=$((current_step + 1))
  fi
  
  percent=$((current_step * 100 / STEPS))
  completed=$((progress_bar_width * percent / 100))
  remaining=$((progress_bar_width - completed))
  
  progress_bar="["
  for ((i=0; i<completed; i++)); do
    progress_bar+="="
  done
  
  if [ $completed -lt $progress_bar_width ]; then
    progress_bar+=">"
    for ((i=0; i<remaining-1; i++)); do
      progress_bar+=" "
    done
  fi
  
  progress_bar+="] $percent%"
  
  echo -ne "\r${progress_bar}"
  
  if [ $current_step -eq $STEPS ]; then
    echo ""
  fi
}

show_success() {
  echo -e "\r${GREEN}${BOLD}✓${NC} $1"
}

show_note() {
  echo -e "  ${DIM}→ ${ITALIC}$1${NC}"
}

show_error() {
  echo -e "${RED}${BOLD}⨯ Error:${NC} $1"
  exit 1
}

command_exists() {
  command -v "$1" &>/dev/null
}

detect_shell_config() {
  if [ -n "$SHELL" ]; then
    shell_name=$(basename "$SHELL")
    case "$shell_name" in
      bash)
        if [ -f "$HOME/.bash_profile" ]; then
          SHELL_CONFIG="$HOME/.bash_profile"
        elif [ -f "$HOME/.bashrc" ]; then
          SHELL_CONFIG="$HOME/.bashrc"
        fi
        ;;
      zsh)
        if [ -f "$HOME/.zshrc" ]; then
          SHELL_CONFIG="$HOME/.zshrc"
        fi
        ;;
      *)
        if [ -f "$HOME/.profile" ]; then
          SHELL_CONFIG="$HOME/.profile"
        fi
        ;;
    esac
  else
    if [ -f "$HOME/.zshrc" ]; then
      SHELL_CONFIG="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
      SHELL_CONFIG="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      SHELL_CONFIG="$HOME/.bash_profile"
    elif [ -f "$HOME/.profile" ]; then
      SHELL_CONFIG="$HOME/.profile"
    fi
  fi
}

check_git() {
  if command_exists git; then
    return 0
  fi
  
  show_note "Git dependency required. Installing..."
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command_exists brew; then
      brew install git &>/dev/null
    else
      show_note "Setting up Homebrew package manager..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" &>/dev/null || {
        show_error "Failed to install Homebrew. Please install Git manually and try again."
      }
      
      if [[ -f "$HOME/.zshrc" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zshrc"
        eval "$(/opt/homebrew/bin/brew shellenv)" &>/dev/null || true
      elif [[ -f "$HOME/.bashrc" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.bashrc"
        eval "$(/opt/homebrew/bin/brew shellenv)" &>/dev/null || true
      fi
      
      brew install git &>/dev/null || {
        show_error "Failed to install Git. Please install it manually and try again."
      }
    fi
  else
    if command_exists apt-get; then
      sudo apt-get update &>/dev/null
      sudo apt-get install -y git &>/dev/null
    elif command_exists dnf; then
      sudo dnf install -y git &>/dev/null
    elif command_exists yum; then
      sudo yum install -y git &>/dev/null
    elif command_exists pacman; then
      sudo pacman -S --noconfirm git &>/dev/null
    elif command_exists zypper; then
      sudo zypper install -y git &>/dev/null
    else
      show_error "Could not install Git. Please install it manually and try again."
    fi
  fi
  
  if ! command_exists git; then
    show_error "Failed to install Git. Please install it manually and try again."
  fi
}

install_bun() {
  if command_exists bun; then
    BUN_CMD="bun"
    return 0
  fi
  
  show_note "Installing Bun JavaScript runtime..."
  
  curl -fsSL https://bun.sh/install | bash &>/dev/null
  
  if [ -n "$SHELL_CONFIG" ]; then
    source "$SHELL_CONFIG" &>/dev/null || true
  fi
  
  if command_exists bun; then
    BUN_CMD="bun"
    return 0
  fi
  
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  
  if command_exists bun; then
    BUN_CMD="bun"
    return 0
  fi
  
  for possible_path in "$HOME/.bun/bin/bun" "/usr/local/bin/bun" "/opt/homebrew/bin/bun"; do
    if [ -f "$possible_path" ] && [ -x "$possible_path" ]; then
      BUN_CMD="$possible_path"
      return 0
    fi
  done
  
  show_error "Could not find or install Bun. Please install it manually with: curl -fsSL https://bun.sh/install | bash"
}

download_code() {
  TEMP_DIR=$(mktemp -d)
  if [ ! -d "$TEMP_DIR" ]; then
    show_error "Failed to create temporary directory"
  fi
  
  DOWNLOAD_SUCCESS=false
  
  if ! $DOWNLOAD_SUCCESS && command_exists git; then
    git clone --quiet --depth=1 --branch "$REPO_BRANCH" "$REPO_URL.git" "$TEMP_DIR/repo" 2>/dev/null
    if [ -d "$TEMP_DIR/repo" ] && [ -f "$TEMP_DIR/repo/package.json" ]; then
      cp -r "$TEMP_DIR/repo/"* "$TEMP_DIR/" 2>/dev/null
      cp -r "$TEMP_DIR/repo/."* "$TEMP_DIR/" 2>/dev/null || true
      rm -rf "$TEMP_DIR/repo"
      DOWNLOAD_SUCCESS=true
    fi
  fi
  
  if ! $DOWNLOAD_SUCCESS && command_exists curl && command_exists unzip; then
    DOWNLOAD_URL="$REPO_URL/archive/refs/heads/$REPO_BRANCH.zip"
    curl -sL "$DOWNLOAD_URL" -o "$TEMP_DIR/furikake.zip" 2>/dev/null
    if [ -f "$TEMP_DIR/furikake.zip" ] && [ -s "$TEMP_DIR/furikake.zip" ]; then
      unzip -q "$TEMP_DIR/furikake.zip" -d "$TEMP_DIR" 2>/dev/null
      DIR_NAME="$REPO_NAME-$REPO_BRANCH"
      if [ -d "$TEMP_DIR/$DIR_NAME" ] && [ -f "$TEMP_DIR/$DIR_NAME/package.json" ]; then
        cp -r "$TEMP_DIR/$DIR_NAME/"* "$TEMP_DIR/" 2>/dev/null
        cp -r "$TEMP_DIR/$DIR_NAME/."* "$TEMP_DIR/" 2>/dev/null || true
        rm -rf "$TEMP_DIR/$DIR_NAME"
        DOWNLOAD_SUCCESS=true
      fi
    fi
  fi
  
  if ! $DOWNLOAD_SUCCESS && command_exists curl && command_exists tar; then
    DOWNLOAD_URL="$REPO_URL/archive/refs/heads/$REPO_BRANCH.tar.gz"
    curl -sL "$DOWNLOAD_URL" -o "$TEMP_DIR/furikake.tar.gz" 2>/dev/null
    if [ -f "$TEMP_DIR/furikake.tar.gz" ] && [ -s "$TEMP_DIR/furikake.tar.gz" ]; then
      tar -xzf "$TEMP_DIR/furikake.tar.gz" -C "$TEMP_DIR" 2>/dev/null
      DIR_NAME="$REPO_NAME-$REPO_BRANCH"
      if [ -d "$TEMP_DIR/$DIR_NAME" ] && [ -f "$TEMP_DIR/$DIR_NAME/package.json" ]; then
        cp -r "$TEMP_DIR/$DIR_NAME/"* "$TEMP_DIR/" 2>/dev/null
        cp -r "$TEMP_DIR/$DIR_NAME/."* "$TEMP_DIR/" 2>/dev/null || true
        rm -rf "$TEMP_DIR/$DIR_NAME"
        DOWNLOAD_SUCCESS=true
      fi
    fi
  fi
  
  if ! $DOWNLOAD_SUCCESS || [ ! -f "$TEMP_DIR/package.json" ] || [ ! -f "$TEMP_DIR/index.ts" ]; then
    show_error "Failed to download Furikake code. Please check your internet connection and try again."
  fi
}

install_app() {
  cd "$TEMP_DIR" || show_error "Failed to navigate to temporary directory"
  
  "$BUN_CMD" install &>/dev/null || "$BUN_CMD" install --no-save &>/dev/null || 
    show_error "Failed to install dependencies. Please try again."
  
  mkdir -p "$FURIKAKE_DIR" &>/dev/null
  mkdir -p "$BIN_DIR" &>/dev/null
  
  cat > "$BIN_DIR/furi" << EOF
#!/usr/bin/env bash

export BASE_PATH="\$HOME"

BUN_CMD=""
if command -v bun &> /dev/null; then
  BUN_CMD="bun"
elif [ -f "\$HOME/.bun/bin/bun" ]; then
  BUN_CMD="\$HOME/.bun/bin/bun"
elif [ -f "/usr/local/bin/bun" ]; then
  BUN_CMD="/usr/local/bin/bun"
elif [ -f "/opt/homebrew/bin/bun" ]; then
  BUN_CMD="/opt/homebrew/bin/bun"
else
  echo "Error: Bun runtime not found. Please reinstall with: curl -fsSL https://furikake.app/install | bash"
  exit 1
fi

if [ ! -f "\$HOME/.furikake/index.ts" ]; then
  echo "Error: Furikake installation is corrupted. Please reinstall with: curl -fsSL https://furikake.app/install | bash"
  exit 1
fi

exec \$BUN_CMD "\$HOME/.furikake/index.ts" "\$@"
EOF
  
  chmod +x "$BIN_DIR/furi" &>/dev/null || 
    show_error "Failed to make the executable script. Check permissions and try again."
  
  cp -r "$TEMP_DIR/"* "$FURIKAKE_DIR/" &>/dev/null
  find "$TEMP_DIR" -type f -name ".*" -maxdepth 1 -exec cp {} "$FURIKAKE_DIR/" \; &>/dev/null || true
    
  if [ ! -f "$FURIKAKE_DIR/index.ts" ]; then
    show_error "Installation failed. Essential files not found."
  fi
}

configure_environment() {
  detect_shell_config
  
  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    if [ -n "$SHELL_CONFIG" ]; then
      {
        echo ""
        echo "# Added by Furikake installer ($(date +%Y-%m-%d))"
        echo "export PATH=\"$BIN_DIR:\$PATH\""
      } >> "$SHELL_CONFIG"
      
      show_note "Updated PATH in $SHELL_CONFIG"
    else
      show_note "Could not determine shell configuration file. You may need to add $BIN_DIR to your PATH manually."
    fi
    
    export PATH="$BIN_DIR:$PATH"
  fi
  
  alias furi="$BIN_DIR/furi" &>/dev/null || true
}

install_pm2() {
  if command_exists pm2; then
    return 0
  fi
  
  show_note "Installing PM2"
  
  if command_exists npm; then
    npm install -g pm2 &>/dev/null || true
  fi
  
  if command_exists pm2; then
    return 0
  fi
  
  if [ -n "$BUN_CMD" ]; then
    $BUN_CMD install -g pm2 &>/dev/null || true
  fi
  
  if command_exists pm2; then
    return 0
  fi
  
  show_error "Could not install PM2, which is required for Furikake. Please install it manually with: bun add -g pm2"
}

main() {
  clear
  echo -e "${CYAN}${BOLD}Furikake Installer${NC}"
  echo -e "${ITALIC}CLI & API for MCP management & execution${NC}"
  echo -e "${DIM}https://furikake.app   $REPO_URL\n${NC}"
  
  current_step=0
  
  if [[ "$OSTYPE" != "darwin"* ]] && [[ "$OSTYPE" != "linux"* ]]; then
    show_error "This installer only supports macOS and Linux environments."
  fi
  
  detect_shell_config
  
  show_progress "Checking prerequisites"
  
  if ! command_exists curl; then
    check_git
  fi
  
  show_progress "Setting up runtime"
  install_bun
  
  show_progress "Downloading Furikake"
  download_code
  
  show_progress "Installing components"
  install_app
  
  show_progress "Configuring environment"
  configure_environment
  
  show_progress "Installing PM2"
  install_pm2
  
  echo -ne "\r\033[K\n"
  
  if [ -n "$SHELL_CONFIG" ] && [ -f "$SHELL_CONFIG" ]; then
    source "$SHELL_CONFIG" 2>/dev/null || true
  fi

  if command_exists furi; then
    furi where
  else
    echo -e "${YELLOW}Note: You may need to restart your terminal before using the ${BOLD}furi${NC}${YELLOW} command${NC}"
  fi

  echo -e "\n${GREEN}${BOLD}✓ furi installed successfully${NC}\n     Run ${DIM}${BOLD}furi${NC} to get started${NC}\n"
}

main "$@" 