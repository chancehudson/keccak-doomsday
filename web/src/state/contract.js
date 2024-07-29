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
  address = "0xbbb33a51e9d61ef9582a4c4639e0e9f8abf03aaf";

  constructor() {
    makeAutoObservable(this);
    this.provider = new ethers.JsonRpcProvider(
      "https://eth-sepolia.g.alchemy.com/v2/SMH5q-gqe7zv8J7BR6OQRZiCd9I8r3le",
    );
    this.contract = new ethers.Contract(this.address, abi, this.provider);
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

  async loadClaim(hash) {
    return this.contract.claims(hash);
  }

  async claimActive(preImage) {
    const claimPreImage = `0x${(BigInt(preImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );
    // check if a claim already exists, finalize claim if possible
    const claim = await this.contract.claims(claimHash);
    return claim.validUntil > +new Date() / 1000;
  }

  async beginClaim(preImage) {
    if (!window.ethereum) {
      throw new Error("no ethereum provider");
    }
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const claimPreImage = `0x${(BigInt(preImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );
    const txData = await this.contract.beginClaim.populateTransaction(
      claimHash,
      accounts[0],
    );
    await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          to: this.contract.target,
          from: accounts[0],
          data: txData.data,
        },
      ],
    });
  }

  async finishClaim(preImage) {
    if (!window.ethereum) {
      throw new Error("no ethereum provider");
    }
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const claimPreImage = `0x${(BigInt(preImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );
    // check if a claim already exists, finalize claim if possible
    const claim = await this.contract.claims(claimHash);
    if (claim.validUntil <= +new Date() / 1000) {
      throw new Error("claim does not exist or is expired");
    }
    if (BigInt(claim.claimant) !== BigInt(accounts[0])) {
      throw new Error("claim already exists and is not yours");
    }
    const txData = await this.contract.finishClaim.populateTransaction(
      preImage,
      this.nextTarget[1],
    );
    await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          to: this.contract.target,
          from: accounts[0],
          data: txData.data,
        },
      ],
    });
  }

  async beginOrFinishClaim(preImage) {
    if (!window.ethereum) {
      throw new Error("no ethereum provider");
    }
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const claimPreImage = `0x${(BigInt(preImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );
    // check if a claim already exists, finalize claim if possible
    const claim = await this.contract.claims(claimHash);
    if (claim.validUntil > +new Date() / 1000) {
      if (BigInt(claim.claimant) !== BigInt(accounts[0])) {
        throw new Error("claim already exists and is not yours");
      }
      const txData = await this.contract.finishClaim.populateTransaction(
        preImage,
        this.nextTarget[1],
      );
      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: this.contract.target,
            from: accounts[0],
            data: txData.data,
          },
        ],
      });
      return;
    }
    const txData = await this.contract.beginClaim.populateTransaction(
      claimHash,
      accounts[0],
    );
    return window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          to: this.contract.target,
          from: accounts[0],
          data: txData.data,
        },
      ],
    });
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
