#!/bin/bash
# The release build's compile cache (.github/workflows/release.yml, "Use the compile cache"): sccache on an R2 bucket
# that every tag's build reads and writes. The job's env carries RELEASE_CACHE_ENDPOINT (the account's R2 endpoint)
# and the bucket's key as AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY; sccache is on PATH (mozilla-actions/sccache-action).
# Each OS and architecture has its own prefix, so a key only ever names one platform's output.
# If the bucket can't be reached, the build goes on uncached: a cache must never be why a release fails.
set -euo pipefail
: "${RELEASE_CACHE_ENDPOINT:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}" "${GITHUB_ENV:?}"
export SCCACHE_BUCKET=raea-build-cache
export SCCACHE_ENDPOINT="$RELEASE_CACHE_ENDPOINT"
export SCCACHE_REGION=auto
export SCCACHE_S3_KEY_PREFIX="release/${RUNNER_OS:-local}-${RUNNER_ARCH:-local}"
# a request that fails mid-build compiles that crate locally instead of failing it
export SCCACHE_IGNORE_SERVER_IO_ERROR=1
# the server stays up for the whole build (cargo's calls are minutes apart while one crate links)
export SCCACHE_IDLE_TIMEOUT=0

if ! sccache --start-server >/dev/null 2>&1; then
  echo "::warning::the compile cache didn't start; building uncached"
  exit 0
fi
stats=$(sccache --show-stats)
echo "$stats" | sed -n '/Cache location/p'
# sccache checks the bucket when it starts: a key without write access is read-only, and no access is an error
if echo "$stats" | grep -qiE 'Cache location +s3' && ! echo "$stats" | grep -qiE 'read.?only'; then
  {
    echo "RUSTC_WRAPPER=sccache"
    for v in SCCACHE_BUCKET SCCACHE_ENDPOINT SCCACHE_REGION SCCACHE_S3_KEY_PREFIX SCCACHE_IGNORE_SERVER_IO_ERROR SCCACHE_IDLE_TIMEOUT; do
      echo "$v=${!v}"
    done
    # C and C++ in build scripts: cc-rs wraps its compiler in sccache when RUSTC_WRAPPER is sccache; CMake reads these
    echo "CMAKE_C_COMPILER_LAUNCHER=sccache"
    echo "CMAKE_CXX_COMPILER_LAUNCHER=sccache"
  } >> "$GITHUB_ENV"
  echo "compile cache on: s3://$SCCACHE_BUCKET/$SCCACHE_S3_KEY_PREFIX"
else
  echo "::warning::the compile cache isn't writable; building uncached"
  echo "$stats"
fi
