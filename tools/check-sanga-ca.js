#!/usr/bin/env node

/**
 * 同梱した中間証明書が、サイバートラストの公開値と一致するかを見る。
 *
 * www.sanga-fc.jp は葉だけを送る。ワークフローはこれを NODE_EXTRA_CA_CERTS で読む。
 * 別の証明書に差し替わると、検証を足したつもりで別の認証局を信頼してしまう。
 * ネットワークには出ない。公開ページの SHA-256 をここに固定して突き合わせる。
 *
 * 確認した公開値（2026-10-15）:
 * https://www.cybertrust.ne.jp/ssl/download-ca/sureserver-ov.html
 * 取得元: http://crl.cybertrust.ne.jp/SureServer/ovcag4/ovcag4.crt
 */

const fs = require('fs');
const path = require('path');
const { X509Certificate } = require('crypto');

const certPath = path.join(__dirname, 'certs', 'cybertrust-japan-sureserver-ca-g4.pem');
const EXPECTED_SHA256 = '83:46:92:2C:B8:73:0B:B6:AE:71:AB:03:BF:C4:24:62:F4:16:04:23:D9:07:9B:E6:43:85:62:1A:C5:87:76:72';
const EXPECTED_CN = 'Cybertrust Japan SureServer CA G4';

function main() {
  const pem = fs.readFileSync(certPath);
  const cert = new X509Certificate(pem);
  if (cert.fingerprint256 !== EXPECTED_SHA256) {
    console.error(`SHA-256 が公開値と違います: ${cert.fingerprint256}`);
    console.error(`  期待: ${EXPECTED_SHA256}`);
    return 1;
  }
  if (!cert.subject.includes(`CN=${EXPECTED_CN}`)) {
    console.error(`subject が違います: ${cert.subject}`);
    return 1;
  }
  const notAfter = Date.parse(cert.validTo);
  if (Number.isNaN(notAfter) || notAfter <= Date.now()) {
    console.error(`中間証明書の有効期限が切れています: ${cert.validTo}`);
    return 1;
  }
  console.log(`中間証明書の SHA-256 は公開値と一致しています（${cert.validTo} まで）`);
  return 0;
}

process.exit(main());
