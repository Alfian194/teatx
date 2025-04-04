```
sudo apt update && sudo apt install -y curl git screen
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```


```
git clone https://github.com/Alfian194/teatx.git

cd teatx

npm install
```

```
nano .env


RPC_URL=https://tea-sepolia.g.alchemy.com/public
PRIVATE_KEY=
MIN_AMOUNT=0.001
MAX_AMOUNT=0.002
INTERVAL_MINUTES=1
```
```
node main.js
```
