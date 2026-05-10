#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Release Script ===${NC}\n"

# Check if working directory is clean
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}Error: Working directory is not clean. Commit or stash your changes first.${NC}"
  exit 1
fi

# Run tests
echo -e "${BLUE}→${NC} Running tests..."
npm test

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Current branch:${NC} $CURRENT_BRANCH"

# Get latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
echo -e "${BLUE}Latest tag:${NC} $LATEST_TAG"

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current package.json version:${NC} $CURRENT_VERSION\n"

# Parse version numbers
if [[ $CURRENT_VERSION =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  MAJOR="${BASH_REMATCH[1]}"
  MINOR="${BASH_REMATCH[2]}"
  PATCH="${BASH_REMATCH[3]}"
else
  echo -e "${RED}Error: Invalid version format in package.json${NC}"
  exit 1
fi

# Calculate suggested versions
PATCH_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
MINOR_VERSION="$MAJOR.$((MINOR + 1)).0"
MAJOR_VERSION="$((MAJOR + 1)).0.0"

# Show suggestions
echo -e "${YELLOW}Version bump suggestions:${NC}"
echo -e "  ${GREEN}1)${NC} Patch: $PATCH_VERSION (bug fixes)"
echo -e "  ${GREEN}2)${NC} Minor: $MINOR_VERSION (new features, backwards compatible)"
echo -e "  ${GREEN}3)${NC} Major: $MAJOR_VERSION (breaking changes)"
echo -e "  ${GREEN}4)${NC} Custom (enter manually)"
echo -e "  ${GREEN}5)${NC} Skip version bump (keep package.json at $CURRENT_VERSION)\n"

# Get user choice
read -p "Select option (1-5) or press Ctrl+C to cancel: " choice

SKIP_VERSION_BUMP=false

case $choice in
  1)
    NEW_VERSION=$PATCH_VERSION
    ;;
  2)
    NEW_VERSION=$MINOR_VERSION
    ;;
  3)
    NEW_VERSION=$MAJOR_VERSION
    ;;
  4)
    read -p "Enter version number (e.g., 1.2.3): " NEW_VERSION
    # Validate format
    if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo -e "${RED}Error: Invalid version format. Must be x.y.z${NC}"
      exit 1
    fi
    ;;
  5)
    SKIP_VERSION_BUMP=true
    NEW_VERSION=$CURRENT_VERSION
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

if [[ "$SKIP_VERSION_BUMP" == true ]]; then
  echo -e "\n${YELLOW}Selected option:${NC} skip version bump (version stays $NEW_VERSION)"
else
  echo -e "\n${YELLOW}Selected version:${NC} $NEW_VERSION"
fi

# Confirm
read -p "$(echo -e ${YELLOW}Are you sure you want to release v$NEW_VERSION? \(y/N\): ${NC})" confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
  echo -e "${RED}Release cancelled${NC}"
  exit 0
fi

echo -e "\n${BLUE}Starting release process...${NC}\n"

# Update package.json version (optional)
if [[ "$SKIP_VERSION_BUMP" == true ]]; then
  echo -e "${BLUE}→${NC} Skipping package.json version update"
else
  echo -e "${BLUE}→${NC} Updating package.json version to $NEW_VERSION"
  npm version $NEW_VERSION --no-git-tag-version
fi

# Build
echo -e "${BLUE}→${NC} Building..."
npm run build

# Commit version bump (optional)
if [[ "$SKIP_VERSION_BUMP" == true ]]; then
  echo -e "${BLUE}→${NC} Skipping version bump commit"
else
  echo -e "${BLUE}→${NC} Committing version bump"
  git add package.json package-lock.json
  git commit -m "chore: bump version to $NEW_VERSION"
fi

# Tag and Push
echo -e "${BLUE}→${NC} Tagging version v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo -e "${BLUE}→${NC} Pushing to git..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

# Check npm login status
echo -e "${BLUE}→${NC} Checking npm login status..."
if ! npm whoami > /dev/null 2>&1; then
  npm login
fi

# Publish
echo -e "${BLUE}→${NC} Publishing to npm..."
npm publish

echo -e "\n${GREEN}Successfully released v$NEW_VERSION!${NC}"