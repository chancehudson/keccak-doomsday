import { ethers } from "ethers";
import { makeAutoObservable } from "mobx";
import KeccakDoomsday from "../../static/KeccakDoomsday.json";
const { abi } = KeccakDoomsday;

export default class ContractState {
  balance = 0;
  halted = false;
  targets = [];
  nextTarget = null;
  expectedReward = 0n;

  constructor() {
    makeAutoObservable(this);
    this.provider = new ethers.JsonRpcProvider(
      "https://eth-sepolia.g.alchemy.com/v2/SMH5q-gqe7zv8J7BR6OQRZiCd9I8r3le",
    );
    this.contract = new ethers.Contract(
      "0x26E2BB2CbA01EcC578674F81b2411F9Ae2286BdD",
      abi,
      this.provider,
    );
    if (typeof window !== "undefined") {
      this.loadPromise = this.load();
    } else {
      // this.loadPromise = this.loadSSR(requestUrl)
    }
  }

  // read the contract state from the blockchain
  async load() {
    await Promise.all([
      this.loadBalance(),
      this.loadHalted(),
      // this.loadTargets(),
      this.loadNextTarget(),
      this.loadExpectedReward(),
    ]);
  }

  async deposit(weiAmount) {
    if (!window.ethereum) {
      throw new Error("no ethereum provider");
    }
    const txData = await this.contract.deposit.populateTransaction({
      value: weiAmount.toString(),
    });
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    console.log(txData.value.toString(16));
    await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          to: this.contract.target,
          from: accounts[0],
          data: txData.data,
          value: `0x${BigInt(weiAmount).toString(16)}`,
        },
      ],
    });
  }

  // load the total balance in the contract
  async loadBalance() {
    this.balance = await this.contract.balance();
  }

  async loadExpectedReward() {
    this.expectedReward = await this.contract.expectedReward();
  }

  async loadHalted() {
    this.halted = await this.contract.halted();
  }

  async loadNextTarget() {
    this.nextTarget = await this.contract.nextTarget();
  }

  // load the targets that are available to be broken
  async loadTargets() {
    const [startBits, len] = await Promise.all([
      this.contract.startBits(),
      this.contract.bitCount(),
    ]);
    const newTargets = [];
    for (let x = startBits; x < startBits + len; x++) {
      const target = await this.contract.targets(x);
      newTargets.push(target);
    }
    this.targets = newTargets;
  }
}
