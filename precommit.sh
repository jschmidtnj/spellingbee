#!/bin/bash

# abort on errors
set -e

npm run precommit --prefix web
npm run precommit --prefix api
git add -A
