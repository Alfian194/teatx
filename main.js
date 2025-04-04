const ethers = require('ethers'); const fs = require('fs'); const path = require('path'); const dotenv = require('dotenv');

dotenv.config();

const CONFIG = { rpcUrl: process.env.RPC_URL || 'https://tea-sepolia.g.alchemy.com/public', privateKeys: process.env.PRIVATE_KEYS?.split(',').map(k => k.trim()) || [], minAmount: process.env.MIN_AMOUNT || '0.001', maxAmount: process.env.MAX_AMOUNT || '0.002', intervalMinutes: parseInt(process.env.INTERVAL_MINUTES) || 1, };

if (CONFIG.privateKeys.length === 0) { console.error('Error: PRIVATE_KEYS is required in .env file (comma-separated).'); process.exit(1); }

const addressFilePath = path.join(__dirname, 'address.txt'); const addressDonePath = path.join(__dirname, 'address_done.txt'); if (!fs.existsSync(addressFilePath)) { console.error('Error: address.txt not found!'); process.exit(1); }

const recipientAddresses = fs .readFileSync(addressFilePath, 'utf-8') .split('\n') .map(addr => addr.trim()) .filter(Boolean);

const addressDone = fs.existsSync(addressDonePath) ? fs.readFileSync(addressDonePath, 'utf-8').split('\n').map(a => a.trim()) : [];

const logsDir = path.join(__dirname, 'logs'); if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

const logFile = path.join(logsDir, 'autosender.log'); const log = (message) => { const timestamp = new Date().toISOString(); const entry = ${timestamp} - ${message}\n; console.log(message); fs.appendFileSync(logFile, entry); };

const getRandomAmount = () => { const min = parseFloat(CONFIG.minAmount); const max = parseFloat(CONFIG.maxAmount); return (Math.random() * (max - min) + min).toFixed(6); };

const sendTransaction = async (wallet, recipient, stats) => { try { const provider = wallet.provider; const amount = getRandomAmount(); const value = ethers.utils.parseEther(amount); const balance = await provider.getBalance(wallet.address); const gasPrice = await provider.getGasPrice(); const gasLimit = 21000; const gasCost = gasPrice.mul(gasLimit); const totalCost = value.add(gasCost);

if (balance.lt(totalCost)) {
  log(`[${wallet.address}] Saldo tidak cukup untuk ${recipient}. Dibutuhkan: ${ethers.utils.formatEther(totalCost)} TEA`);
  stats.failed++;
  return;
}

const tx = {
  to: recipient,
  value,
  gasPrice,
  gasLimit,
};

log(`[${wallet.address}] Mengirim ${amount} TEA ke ${recipient}...`);
const txResult = await wallet.sendTransaction(tx);
log(`Tx terkirim! Hash: ${txResult.hash}`);
log(`Explorer: https://sepolia.tea.xyz/tx/${txResult.hash}`);
const receipt = await txResult.wait(1);

if (receipt.status === 1) {
  stats.success++;
  log(`✅ Berhasil: ${wallet.address} mengirim ${amount} TEA ke ${recipient}`);
} else {
  stats.failed++;
  log(`❌ Gagal: ${wallet.address} -> ${recipient}`);
}

} catch (err) { stats.failed++; log(Error saat mengirim ke ${recipient}: ${err.message}); } };

const startAutoSender = async () => { log('===== TEA Multi-Address Auto Sender Dimulai ====='); log(Jumlah wallet: ${CONFIG.privateKeys.length}); log(Jumlah penerima: ${recipientAddresses.length}); log(Range TEA: ${CONFIG.minAmount} - ${CONFIG.maxAmount}); log(Interval: ${CONFIG.intervalMinutes} menit\n);

const wallets = CONFIG.privateKeys.map((key) => { const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl); return new ethers.Wallet(key, provider); });

const statsMap = new Map(); for (const wallet of wallets) { statsMap.set(wallet.address, { success: 0, failed: 0 }); }

const sendAll = async () => { for (let i = 0; i < recipientAddresses.length; i++) { const recipient = recipientAddresses[i];

if (addressDone.includes(recipient)) {
    log(`Lewati ${recipient} karena sudah selesai.`);
    continue;
  }

  log(`\nAddress ${i + 1} (${recipient}) sedang memproses transaksi...`);

  let allSuccess = true;

  for (const wallet of wallets) {
    const stats = statsMap.get(wallet.address);
    const beforeSuccess = stats.success;
    await sendTransaction(wallet, recipient, stats);
    const afterSuccess = stats.success;

    if (afterSuccess === beforeSuccess) {
      allSuccess = false;
    }
  }

  for (const wallet of wallets) {
    const stats = statsMap.get(wallet.address);
    log(`==> ${wallet.address} selesai ${stats.success + stats.failed} transaksi, ${stats.failed} gagal, ${stats.success} sukses`);
  }

  log(`Transaksi address ${i + 1} telah selesai.`);

  if (allSuccess) {
    fs.appendFileSync(addressDonePath, recipient + '\n');
    log(`Address ${recipient} ditandai sebagai selesai.`);
  } else {
    log(`Address ${recipient} TIDAK ditandai karena ada transaksi gagal.`);
  }
}

};

await sendAll(); setInterval(sendAll, CONFIG.intervalMinutes * 60 * 1000); };

process.on('uncaughtException', (err) => log(Uncaught Exception: ${err.message})); process.on('unhandledRejection', (reason) => log(Unhandled Rejection: ${reason})); process.on('SIGINT', () => { log('⛔ Dihentikan oleh pengguna.'); process.exit(0); });

startAutoSender();

