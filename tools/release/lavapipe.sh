#!/usr/bin/env bash
# Mesa's lavapipe 26.2.4 (software Vulkan, MIT) on a Windows runner, for release checks that render: the runner has no
# GPU, and WARP crashes compiling one of Bevy's compute shaders (11-04). On the runner only, never in a zip.
set -euo pipefail
mkdir -p "$RUNNER_TEMP/mesa" && cd "$RUNNER_TEMP/mesa"
curl -fsSL -o mesa.7z https://github.com/pal1000/mesa-dist-win/releases/download/26.2.4/mesa3d-26.2.4-release-msvc.7z
7z x -y mesa.7z x64/vulkan_lvp.dll x64/lvp_icd.x86_64.json >/dev/null
icd=$(cygpath -w "$RUNNER_TEMP/mesa/x64/lvp_icd.x86_64.json")
# the runner's shell is elevated, and the Vulkan loader ignores VK_DRIVER_FILES for an elevated process: the driver is
# registered where an installed one is
pwsh -c "New-Item -Path HKLM:\\SOFTWARE\\Khronos\\Vulkan\\Drivers -Force | Out-Null; New-ItemProperty -Path HKLM:\\SOFTWARE\\Khronos\\Vulkan\\Drivers -Name '$icd' -PropertyType DWord -Value 0 -Force | Out-Null"

# The Vulkan loader (Khronos, Apache 2.0) from LunarG's runtime components. GitHub's image has vulkan-1.dll in
# System32; Namespace's Windows image doesn't, and rc6's check died there with "vulkan drivers/libraries could not be
# loaded" and not one loader line (11-13). Its vulkaninfo proves the loader sees lavapipe before the check runs.
rt=VulkanRT-X64-1.4.328.1-Components
curl -fsSL -o rt.zip "https://sdk.lunarg.com/sdk/download/1.4.328.1/windows/$rt.zip"
echo "293efbb2c11e60429df7770f40e3c5c811a7fa42af81de0cc41e8718ddb2b373  rt.zip" | sha256sum -c --quiet
7z x -y rt.zip "$rt/x64/vulkan-1.dll" "$rt/x64/vulkaninfo.exe" >/dev/null
sys=$(cygpath -u "$SYSTEMROOT")/System32
if [ ! -f "$sys/vulkan-1.dll" ]; then
  cp "$rt/x64/vulkan-1.dll" "$sys/"
  echo "lavapipe: installed the Vulkan loader from $rt (the image had none)"
fi
out=$("$rt/x64/vulkaninfo.exe" --summary 2>&1) || true
echo "$out" | grep -E "deviceName|driverName|apiVersion" || true
echo "$out" | grep -qi llvmpipe || { echo "$out" | tail -40; echo "lavapipe: the Vulkan loader doesn't see lavapipe" >&2; exit 1; }
{ echo "WGPU_BACKEND=vulkan"; echo "VK_LOADER_DEBUG=error,driver"; } >> "$GITHUB_ENV"
