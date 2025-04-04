const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  rpcUrl: process.env.RPC_URL,
  privateKeys: process.env.PRIVATE_KEYS?.split(',') || [],
  minAmount: process.env.MIN_AMOUNT || '0.001',
  maxAmount: process.env.MAX_AMOUNT || '0.002',
  intervalSeconds: parseInt(process.env.INTERVAL_SECONDS) || 5,
};

if (CONFIG.privateKeys.length === 0) {
  console.error('PRIVATE_KEYS harus diisi di .env');
  process.exit(1);
}

// Read recipients from address.txt
const addressFilePath = path.join(__dirname, 'address.txt');
if (!fs.existsSync(addressFilePath)) {
  console.error('File address.txt tidak ditemukan');
  process.exit(1);
}
const recipients = fs.readFileSync(addressFilePath, 'utf-8')
  .split('\n')
  .map(addr => addr.trim())
  .filter(Boolean);

// Create logs dir
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}
const logFile = path.join(logsDir, 'autosender.log');
const log = (msg) => {
  const line = `${new Date().toISOString()} - ${msg}\n`;
  console.log(msg);
  fs.appendFileSync(logFile, line);
};

const getRandomAmount = () => {
  const min = parseFloat(CONFIG.minAmount);
  const max = parseFloat(CONFIG.maxAmount);
  return (Math.random() * (max - min) + min).toFixed(6);
};

const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);

// Initialize multiple wallets
const wallets = CONFIG.privateKeys.map(pk => new ethers.Wallet(pk.trim(), provider));

const sendTransaction = async (wallet, recipient) => {
  try {
    const amount = getRandomAmount();
    const amountWei = ethers.utils.parseEther(amount);
    const balance = await wallet.getBalance();
    const gasPrice = await provider.getGasPrice();
    const gasLimit = 21000;
    const gasCost = gasPrice.mul(gasLimit);
    const totalCost = amountWei.add(gasCost);

    if (balance.lt(totalCost)) {
      log(`❌ ${wallet.address} saldo tidak cukup untuk kirim ke ${recipient}`);
      return;
    }

    const tx = {
      to: recipient,
      value: amountWei,
      gasPrice,
      gasLimit
    };

    log(`🔁 ${wallet.address} mengirim ${amount} TEA ke ${recipient}...`);
    const sentTx = await wallet.sendTransaction(tx);
    log(`✅ TX terkirim: https://sepolia.tea.xyz/tx/${sentTx.hash}`);
  } catch (err) {
    log(`❌ Error dari ${wallet.address} ke ${recipient}: ${err.message}`);
  }
};

const start = async () => {
  log('===== Auto Sender Start =====');
  log(`Jumlah Wallet: ${wallets.length}`);
  log(`Jumlah Penerima: ${recipients.length}`);
  log(`Interval: ${CONFIG.intervalSeconds} detik`);
  log(`Amount: ${CONFIG.minAmount} - ${CONFIG.maxAmount} TEA\n`);

  const loop = async () => {
    for (const wallet of wallets) {
      for (const recipient of recipients) {
        await sendTransaction(wallet, recipient);
      }
    }
  };

  await loop(); // run first time
  setInterval(loop, CONFIG.intervalSeconds * 1000);
};

start();
