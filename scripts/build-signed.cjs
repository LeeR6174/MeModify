const { spawnSync } = require('child_process');
const fs = require('fs');

const certificateLink = process.env.CSC_LINK;

if (!certificateLink) {
  console.error(
    '署名証明書が設定されていません。CSC_LINK に .pfx/.p12 または証明書ストアの参照を設定してください。'
  );
  process.exit(1);
}

if (
  !certificateLink.startsWith('file://') &&
  !certificateLink.includes('://') &&
  !fs.existsSync(certificateLink)
) {
  console.error('指定された .pfx/.p12 ファイルが見つかりません。');
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--win', 'nsis', '--x64']);
