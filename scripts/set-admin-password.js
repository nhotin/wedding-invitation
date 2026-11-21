#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DEFAULT_ENV_FILE } = require('../backend/config.js');
const { hashPassword } = require('../backend/security.js');

const envFile = process.env.WEDDING_ENV_FILE || DEFAULT_ENV_FILE;

function updateEnvVar(filePath, key, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  let lines = [];
  if (fs.existsSync(filePath)) {
    lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  }
  let replaced = false;
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!replaced) {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    out.push(`${key}=${value}`);
  }
  fs.writeFileSync(filePath, out.join('\n').replace(/\n+$/, '\n'), { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Nhập mật khẩu quản trị mới (tối thiểu 8 ký tự): ', (answer) => {
  rl.close();
  const pwd = String(answer || '').trim();
  if (pwd.length < 8) {
    console.error('Lỗi: Mật khẩu phải có ít nhất 8 ký tự.');
    process.exit(1);
  }
  const hashed = hashPassword(pwd);
  updateEnvVar(envFile, 'ADMIN_PASSWORD_HASH', hashed);
  console.log(`Đã cập nhật ADMIN_PASSWORD_HASH (scrypt) tại ${envFile}.`);
  console.log('Hãy khởi động lại service: systemctl --user restart wedding-invitation.service');
});
