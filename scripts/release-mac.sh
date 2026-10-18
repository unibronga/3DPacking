#!/bin/zsh
# Сборка для раздачи: подпись Developer ID, нотаризация Apple, скрепка (staple), zip.
# Нужно один раз: сертификат «Developer ID Application» в связке ключей и профиль
#   xcrun notarytool store-credentials 3dpacking-notary --apple-id … --team-id …
set -euo pipefail
cd "$(dirname "$0")/.."

ID=$(security find-identity -v -p codesigning | sed -n 's/.*"Developer ID Application: \(.*\)"/\1/p' | head -1)
if [[ -z "$ID" ]]; then
  echo "Нет сертификата «Developer ID Application» в связке ключей." >&2
  echo "Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application." >&2
  exit 1
fi
PROFILE=${APPLE_KEYCHAIN_PROFILE:-3dpacking-notary}
if ! xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1; then
  echo "Нет профиля нотаризации «$PROFILE»: xcrun notarytool store-credentials $PROFILE --apple-id … --team-id …" >&2
  exit 1
fi
echo "Подпись: Developer ID Application: $ID · нотаризация: $PROFILE"

npm run build
# Hardened runtime и права Electron electron-builder ставит сам (свои entitlements по умолчанию).
APPLE_KEYCHAIN_PROFILE="$PROFILE" npx electron-builder --mac --dir --publish never \
  -c.mac.identity="$ID" -c.mac.hardenedRuntime=true -c.mac.notarize=true

APP=release/mac-arm64/3DPacking.app
xcrun stapler staple "$APP"
spctl --assess --type execute --verbose=2 "$APP"
rm -f release/3DPacking-mac-arm64.zip
ditto -c -k --sequesterRsrc --keepParent "$APP" release/3DPacking-mac-arm64.zip
shasum -a 256 release/3DPacking-mac-arm64.zip
