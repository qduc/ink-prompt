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
echo -e "  ${GREEN}4)${NC} Custom (enter manually)\n"

# Get user choice
read -p "Select version bump (1-4) or press Ctrl+C to cancel: " choice

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
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo -e "\n${YELLOW}Selected version:${NC} $NEW_VERSION"

# Confirm
read -p "$(echo -e ${YELLOW}Are you sure you want to release v$NEW_VERSION? \(y/N\): ${NC})" confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
  echo -e "${RED}Release cancelled${NC}"
  exit 0
fi

echo -e "\n${BLUE}Starting release process...${NC}\n"

# Update package.json version
echo -e "${BLUE}→${NC} Updating package.json version to $NEW_VERSION"
npm version $NEW_VERSION --no-git-tag-version

# Run tests
echo -e "${BLUE}→${NC} Running tests..."
npm test

# Build
echo -e "${BLUE}→${NC} Building..."
npm run build

# Commit version bump
echo -e "${BLUE}→${NC} Committing version bump"
git add package.json package-lock.json
git commit -m "chore: bump version to $NEW_VERSION"

# Merge to main if not already on main
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${BLUE}→${NC} Switching to main branch"
  git checkout main

  echo -e "${BLUE}→${NC} Pulling latest changes"
  git pull origin main

  echo -e "${BLUE}→${NC} Merging $CURRENT_BRANCH into main"
  git merge --no-ff $CURRENT_BRANCH -m "chore: merge $CURRENT_BRANCH for release v$NEW_VERSION"
fi

# Create tag
echo -e "${BLUE}→${NC} Creating tag v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# Push
echo -e "${BLUE}→${NC} Pushing to origin"
git push origin main
git push origin "v$NEW_VERSION"

echo -e "\n${GREEN}✓ Release v$NEW_VERSION completed successfully!${NC}"
echo -e "${YELLOW}Note: CI tests will run for the tag. Monitor GitHub Actions.${NC}"

# Switch back to original branch if needed
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${BLUE}→${NC} Switching back to $CURRENT_BRANCH"
  git checkout $CURRENT_BRANCH
fi

echo -e "\n${BLUE}Next steps:${NC}"
echo -e "  1. Wait for CI tests to pass on GitHub"
echo -e "  2. Run: ${GREEN}npm publish${NC} (or ${GREEN}npm publish --access public${NC} for scoped packages)"
