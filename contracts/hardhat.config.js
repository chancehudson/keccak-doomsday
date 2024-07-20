/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("solidity-coverage");

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      blockGasLimit: 12000000,
    },
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/SMH5q-gqe7zv8J7BR6OQRZiCd9I8r3le",
      accounts: [
        "2094f6bcbe5f1262264e4effb04cd0ec4b5925cb3366fd829d6f4aefbfff1e7d",
      ],
    },
    local: {
      url: "http://localhost:8545",
      accounts: [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      ],
    },
  },
};
