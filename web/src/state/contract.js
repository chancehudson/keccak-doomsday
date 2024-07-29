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
      "0xB002A3875D74CF7B6364bf28616147dDEb5af9bD",
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
      this.loadTargets(),
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
    // TODO: return this directly
    const bitCount = await this.contract.bitCount();
    this.expectedReward = BigInt(this.balance) / BigInt(bitCount);
  }

  async loadHalted() {
    this.halted = await this.contract.halted();
  }

  // load the targets that are available to be broken
  async loadTargets() {
    const [startBits, len] = await Promise.all([
      this.contract.startBits(),
      this.contract.bitCount(),
    ]);
    const newTargets = [];
    let nextTarget = null;
    for (let x = startBits; x < startBits + len; x++) {
      const target = await this.contract.targets(x);
      if (target.claimed === false && nextTarget === null) {
        nextTarget = target;
      }
      newTargets.push(target);
    }
    this.targets = newTargets;
    // TODO: return this directly
    this.nextTarget = nextTarget;
  }
}
