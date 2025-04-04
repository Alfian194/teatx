const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const CONFIG = {
  rpcUrl: process.env.RPC_URL || 'https://tea-sepolia.g.alchemy.com/public',
  privateKeys: (process.env.PRIVATE_KEYS || '').split(',').map(k => k.trim()).filter(Boolean),
  minAmount: '0.001',
  maxAmount: '0.002',
  intervalMinutes: parseInt(process.env.INTERVAL_MINUTES) || 1
};

if (CONFIG.privateKeys.length === 0) {
  console.error('Error: PRIVATE_KEYS is required in .env file');
  process.exit(1);
}

const addressFilePath = path.join(__dirname, 'address.txt');
if (!fs.existsSync(addressFilePath)) {
  console.error('Error: address.txt not found!');
  process.exit(1);
}
const recipientAddresses = fs
  .readFileSync(addressFilePath, 'utf-8')
  .split('\n')
  .map(addr => addr.trim())
  .filter(Boolean);

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'autosender.log');
const log = (message) => {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} - ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFile, entry);
};

const getRandomAmount = () => {
  const min = parseFloat(CONFIG.minAmount);
  const max = parseFloat(CONFIG.maxAmount);
  const randomAmount = Math.random() * (max - min) + min;
  return randomAmount.toFixed(6);
};

const initializeWallet = async (privateKey) => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    log(`\nWallet: ${wallet.address}`);
    log(`Balance: ${ethers.utils.formatEther(balance)} TEA`);
    return { wallet, provider };
  } catch (error) {
    log(`Error initializing wallet: ${error.message}`);
    return null;
  }
};

const sendTransaction = async (wallet, provider, recipient) => {
  try {
    const amountToSend = getRandomAmount();
    const amountToSendWei = ethers.utils.parseEther(amountToSend);

    const balance = await provider.getBalance(wallet.address);
    const gasPrice = await provider.getGasPrice();
    const gasLimit = 21000;
    const gasCost = gasPrice.mul(gasLimit);
    const totalCost = amountToSendWei.add(gasCost);

    if (balance.lt(totalCost)) {
      log(`Insufficient balance for ${wallet.address} to ${recipient}. Needed: ${ethers.utils.formatEther(totalCost)} TEA`);
      return;
    }

    const tx = {
      to: recipient,
      value: amountToSendWei,
      gasPrice,
      gasLimit
    };

    log(`Sending ${amountToSend} TEA from ${wallet.address} to ${recipient}...`);
    const transaction = await wallet.sendTransaction(tx);
    log(`Tx sent! Hash: ${transaction.hash}`);
    log(`Explorer: https://sepolia.tea.xyz/tx/${transaction.hash}`);
    const receipt = await transaction.wait(1);

    if (receipt.status === 1) {
      log(`✅ Confirmed: ${wallet.address} → ${recipient}, Amount: ${amountToSend} TEA`);
    } else {
      log(`❌ Failed transaction from ${wallet.address} to ${recipient}`);
    }
  } catch (error) {
    log(`Error sending from ${wallet.address} to ${recipient}: ${error.message}`);
  }
};

const startAutoSender = async () => {
  log('\n===== TEA MULTI-WALLET AUTO SENDER STARTED =====');
  log(`Total wallets: ${CONFIG.privateKeys.length}`);
  log(`Total recipients: ${recipientAddresses.length}`);
  log(`Amount range: ${CONFIG.minAmount} - ${CONFIG.maxAmount} TEA`);
  log(`Interval: ${CONFIG.intervalMinutes} minutes\n`);

  const walletProviders = [];
  for (const pk of CONFIG.privateKeys) {
    const wp = await initializeWallet(pk);
    if (wp) walletProviders.push(wp);
  }

  const sendToAll = async () => {
    for (const { wallet, provider } of walletProviders) {
      for (const recipient of recipientAddresses) {
        await sendTransaction(wallet, provider, recipient);
      }
    }
  };

  await sendToAll(); // Initial send
  setInterval(sendToAll, CONFIG.intervalMinutes * 60 * 1000);
};

process.on('uncaughtException', (err) => log(`Uncaught Exception: ${err.message}`));
process.on('unhandledRejection', (reason) => log(`Unhandled Rejection: ${reason}`));
process.on('SIGINT', () => {
  log('⛔ Stopped by user.');
  process.exit(0);
});

startAutoSender();
