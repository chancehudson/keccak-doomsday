const { expect } = require("chai");
const assert = require("assert");
const hre = require("hardhat");
// const { time } =
const { ethers } = hre;

const findCollision = (target, bits, startAt = 0) => {
  const target_bits = BigInt(target)
    .toString(2)
    .split("")
    .reverse()
    .slice(0, bits)
    .join("");
  let v = startAt;
  for (;;) {
    const i = `0x${BigInt(v).toString(16).padStart(64, "0")}`;
    v++;
    const out = ethers.solidityPackedKeccak256(["bytes32"], [i]);
    const out_bits = BigInt(out)
      .toString(2)
      .split("")
      .reverse()
      .slice(0, bits)
      .join("");
    if (out_bits === target_bits) {
      return i;
    }
  }
};

const findOneOffCollision = (target, bits) => {
  let startAt = 1 << 40;
  for (;;) {
    const collision = findCollision(target, bits);
    const target_bits = BigInt(target)
      .toString(2)
      .split("")
      .reverse()
      .slice(0, bits + 1)
      .join("");
    const collision_hash_bits = BigInt(
      ethers.solidityPackedKeccak256(["bytes32"], [collision]),
    )
      .toString(2)
      .split("")
      .reverse()
      .slice(0, bits + 1)
      .join("");
    if (target_bits != collision_hash_bits) {
      console.log(target_bits, collision_hash_bits);
      return collision;
    }
    startAt += 1 << 40;
  }
};

async function deploy(startBits = 10, bitCount = 19) {
  const rootHash =
    "0x9000000000000000000000000000000000000000000000000000000000000000";
  const doomsday = await hre.ethers.deployContract("KeccakDoomsday", [
    rootHash,
    startBits,
    bitCount,
  ]);
  return doomsday;
}

describe("Doomsday", function () {
  it("should initialize with targets", async () => {
    const startBits = 10;
    const bitCount = 10;
    const doomsday = await deploy(startBits, bitCount);
    const rootHash = await doomsday.rootHash();
    const targets = Array(bitCount)
      .fill()
      .map((_, i) => {
        return `0x${(BigInt(rootHash) + BigInt(startBits + i)).toString(16).padStart(64, "0")}`;
      });
    const bits = Array(bitCount)
      .fill()
      .map((_, i) => startBits + i);
    assert.equal(await doomsday.rootHash(), rootHash);
    assert.equal(await doomsday.bitCount(), bitCount);
    for (let x = 0; x < bitCount; x++) {
      const [hash, bitLength, claimed, claimedBy] = await doomsday.targets(
        bits[x],
      );
      assert.equal(hash, targets[x]);
      assert.equal(bitLength, bits[x]);
      assert.equal(claimed, false);
      const zero = `0x${Array(40).fill("0").join("")}`;
      assert.equal(claimedBy, zero);
    }
  });

  it("should deposit ether in contract", async () => {
    const startBits = 10;
    const bitCount = 10;
    const doomsday = await deploy(startBits, bitCount);
    const [signer1, signer2] = await ethers.getSigners();
    const sendAmount1 = "12904129402104990124";
    const WEI_PER_TOKEN = await doomsday.WEI_PER_TOKEN();
    await expect(
      doomsday.deposit({
        value: "0",
      }),
    ).to.be.revertedWith("invalid deposit value");
    await expect(
      doomsday.deposit({
        value: (WEI_PER_TOKEN - 1n).toString(),
      }),
    ).to.be.revertedWith("invalid deposit value");
    {
      await doomsday.deposit({
        from: signer1,
        value: sendAmount1,
      });

      {
        const tokenBalance = await doomsday.balanceOf(signer1.address);
        assert.equal(tokenBalance, BigInt(sendAmount1) / WEI_PER_TOKEN);
      }
      {
        const tokenBalance = await doomsday.balanceOf(signer2.address);
        assert.equal(tokenBalance, "0");
      }
      const contractBalance = await doomsday.balance();
      assert.equal(contractBalance, sendAmount1);
    }
    {
      const sendAmount2 = "192214910442104";
      await doomsday.connect(signer2).deposit({
        from: signer2,
        value: sendAmount2,
      });
      const tokenBalance = await doomsday.balanceOf(signer2.address);
      assert.equal(tokenBalance, BigInt(sendAmount2) / WEI_PER_TOKEN);
      const contractBalance = await doomsday.balance();
      assert.equal(
        contractBalance,
        (BigInt(sendAmount1) + BigInt(sendAmount2)).toString(),
      );
    }
  });

  it("should claim target", async () => {
    const startBits = 10;
    const bitCount = 19;
    const doomsday = await deploy(startBits, bitCount);
    const rootHash = await doomsday.rootHash();
    const [signer] = await ethers.getSigners();
    const sendAmount = "1294019401094";
    await doomsday.deposit({
      value: sendAmount,
    });
    const targets = Array(bitCount)
      .fill()
      .map((_, i) => {
        return `0x${(BigInt(rootHash) + BigInt(startBits + i)).toString(16).padStart(64, "0")}`;
      });

    const collisionPreImage = findCollision(targets[0], startBits);
    const claimPreImage = `0x${(BigInt(collisionPreImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );
    const expectedReward = BigInt(await doomsday.balance()) / BigInt(bitCount);
    const startBalance = await doomsday.balance();

    await doomsday.beginClaim(claimHash, signer.address);
    await expect(
      doomsday.beginClaim(claimHash, signer.address),
    ).to.be.revertedWith("claim already exists");

    // fail to claim with non-colliding pre-image
    await expect(doomsday.finishClaim(rootHash, bitCount)).to.be.revertedWith(
      "claim has expired or does not exist",
    );
    // fail to claim for incorrect bit count
    await expect(
      doomsday.finishClaim(collisionPreImage, bitCount + 1),
    ).to.be.revertedWith("hash mismatch");

    // fail to claim for bit count that is not enabled
    await expect(doomsday.finishClaim(collisionPreImage, 1)).to.be.revertedWith(
      "target not enabled",
    );

    await expect(doomsday.finishClaim(collisionPreImage, startBits)).to.emit(
      doomsday,
      "HashClaimed",
    );
    // fail to double claim
    await expect(
      doomsday.finishClaim(collisionPreImage, startBits),
    ).to.be.revertedWith("target has already been claimed");
    const endBalance = await doomsday.balance();
    assert.equal(expectedReward, BigInt(startBalance) - BigInt(endBalance));
  });

  it("should compare bits correctly", async () => {
    const startBits = 10;
    const bitCount = 19;
    const doomsday = await deploy(startBits, bitCount);
    const rootHash = await doomsday.rootHash();
    const [signer] = await ethers.getSigners();
    const sendAmount = "1294019401094";
    await doomsday.deposit({
      value: sendAmount,
    });
    const targets = Array(bitCount)
      .fill()
      .map((_, i) => {
        return `0x${(BigInt(rootHash) + BigInt(startBits + i)).toString(16).padStart(64, "0")}`;
      });

    const preImage = findOneOffCollision(targets[0], startBits - 1);
    // const snapshot = await network.provider.request({
    //   method: "evm_snapshot",
    //   params: [],
    // });
    const claimPreImage = `0x${(BigInt(preImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );
    await doomsday.beginClaim(claimHash, signer.address);
    await expect(doomsday.finishClaim(preImage, startBits)).to.be.revertedWith(
      "hash mismatch",
    );
    // await network.provider.request({
    //   method: "evm_revert",
    //   params: [snapshot],
    // });
  });

  it("should fail to claim after time expires", async () => {
    const startBits = 10;
    const bitCount = 19;
    const doomsday = await deploy(startBits, bitCount);
    const rootHash = await doomsday.rootHash();
    const CLAIM_TIMEOUT = await doomsday.CLAIM_TIMEOUT();
    const [signer] = await ethers.getSigners();
    const targets = Array(bitCount)
      .fill()
      .map((_, i) => {
        return `0x${(BigInt(rootHash) + BigInt(startBits + i)).toString(16).padStart(64, "0")}`;
      });

    const collisionPreImage = findCollision(targets[0], startBits);
    const claimPreImage = `0x${(BigInt(collisionPreImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );

    await doomsday.beginClaim(claimHash, signer.address);

    await network.provider.request({
      method: "evm_increaseTime",
      params: [CLAIM_TIMEOUT.toString()],
    });

    await expect(
      doomsday.finishClaim(collisionPreImage, startBits),
    ).to.be.revertedWith("claim has expired or does not exist");
  });

  it("should halt contract", async () => {
    const startBits = 10;
    const bitCount = 19;
    const doomsday = await deploy(startBits, bitCount);
    const rootHash = await doomsday.rootHash();
    const HALT_TIMEOUT = await doomsday.HALT_TIMEOUT();
    assert.equal(false, await doomsday.halted());
    await network.provider.request({
      method: "evm_increaseTime",
      params: [HALT_TIMEOUT.toString()],
    });
    const exec = async (fn = async () => {}) => {
      const snapshot = await network.provider.request({
        method: "evm_snapshot",
        params: [],
      });
      await fn();
      await network.provider.request({
        method: "evm_revert",
        params: [snapshot],
      });
    };
    // execute between snapshots to ensure haltIfNeeded is called
    await exec(async () => {
      const [signer] = await ethers.getSigners();
      const sendAmount1 = "1290490124";
      await expect(
        doomsday.deposit({
          value: sendAmount1,
        }),
      ).to.be.revertedWith("contract is halted");
    });
    await exec(async () => {
      await expect(doomsday.finishClaim(rootHash, 0)).to.be.revertedWith(
        "contract is halted",
      );
    });
    await exec(async () => {
      const [signer] = await ethers.getSigners();
      await expect(
        doomsday.beginClaim(rootHash, signer.address),
      ).to.be.revertedWith("contract is halted");
    });
  });

  it("should fail to withdraw before halting", async () => {
    const doomsday = await deploy();
    const [signer] = await ethers.getSigners();
    await expect(doomsday.withdraw(0, signer.address)).to.be.revertedWith(
      "contract is not halted",
    );
    await expect(
      doomsday.withdrawFrom(0, signer.address, signer.address),
    ).to.be.revertedWith("contract is not halted");
  });

  it("should allow withdrawal", async () => {
    const startBits = 10;
    const bitCount = 19;
    const doomsday = await deploy(startBits, bitCount);
    const rootHash = await doomsday.rootHash();
    const [signer1, signer2] = await ethers.getSigners();
    const signer1DepositAmount = "12120421509750109419";
    const signer2DepositAmount = "651905992499021940294";
    {
      await doomsday.connect(signer1).deposit({
        value: signer1DepositAmount,
      });
    }
    {
      await doomsday.connect(signer2).deposit({
        value: signer2DepositAmount,
      });
    }
    const targets = Array(bitCount)
      .fill()
      .map((_, i) => {
        return `0x${(BigInt(rootHash) + BigInt(startBits + i)).toString(16).padStart(64, "0")}`;
      });

    const collisionPreImage = findCollision(targets[0], startBits);
    const claimPreImage = `0x${(BigInt(collisionPreImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );

    await doomsday.beginClaim(claimHash, signer1.address);
    await expect(doomsday.finishClaim(collisionPreImage, startBits)).to.emit(
      doomsday,
      "HashClaimed",
    );

    const HALT_TIMEOUT = await doomsday.HALT_TIMEOUT();
    await network.provider.request({
      method: "evm_increaseTime",
      params: [HALT_TIMEOUT.toString()],
    });

    await doomsday.haltIfNeeded();
    const finalWeiPerToken = await doomsday.finalWeiPerToken();
    // withdraw a single token
    {
      const target = `0x${Array(40).fill("1").join("")}`;
      const startBalance = await doomsday.balanceOf(signer1.address);
      await doomsday.connect(signer1).withdraw(1, target);
      const endBalance = await doomsday.balanceOf(signer1.address);
      assert.equal(BigInt(endBalance), BigInt(startBalance) - 1n);
      const destBalance = await signer1.provider.getBalance(target);
      assert.equal(BigInt(destBalance), finalWeiPerToken);
    }
    // withdraw all tokens
    {
      const target = `0x${Array(40).fill("2").join("")}`;
      const startBalance = await doomsday.balanceOf(signer1.address);
      // fail to withdraw more than balance
      await expect(
        doomsday.connect(signer1).withdraw(startBalance + 1n, target),
      ).to.be.reverted;
      await doomsday.connect(signer1).withdraw(startBalance, target);
      const destBalance = await signer1.provider.getBalance(target);
      assert.equal(BigInt(destBalance), finalWeiPerToken * startBalance);
    }
  });

  it("should allow withdrawFrom", async () => {
    const startBits = 10;
    const bitCount = 19;
    const doomsday = await deploy(startBits, bitCount);
    const rootHash = await doomsday.rootHash();
    const [signer1, signer2, signer3] = await ethers.getSigners();
    const signer1DepositAmount = "12120421509750109419";
    const signer2DepositAmount = "651905992499021940294";
    {
      await doomsday.connect(signer1).deposit({
        value: signer1DepositAmount,
      });
    }
    {
      await doomsday.connect(signer2).deposit({
        value: signer2DepositAmount,
      });
    }
    const targets = Array(bitCount)
      .fill()
      .map((_, i) => {
        return `0x${(BigInt(rootHash) + BigInt(startBits + i)).toString(16).padStart(64, "0")}`;
      });

    const collisionPreImage = findCollision(targets[0], startBits);
    const claimPreImage = `0x${(BigInt(collisionPreImage) + 1n).toString(16).padStart(64, "0")}`;
    const claimHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [claimPreImage],
    );

    await doomsday.beginClaim(claimHash, signer1.address);
    await expect(doomsday.finishClaim(collisionPreImage, startBits)).to.emit(
      doomsday,
      "HashClaimed",
    );

    const HALT_TIMEOUT = await doomsday.HALT_TIMEOUT();
    await network.provider.request({
      method: "evm_increaseTime",
      params: [HALT_TIMEOUT.toString()],
    });

    await doomsday.haltIfNeeded();
    const finalWeiPerToken = await doomsday.finalWeiPerToken();
    const target = `0x${Array(40).fill("f").join("")}`;
    await doomsday.connect(signer1).approve(signer3.address, 1);
    await expect(
      doomsday.connect(signer3).withdrawFrom(2, signer1.address, target),
    ).to.be.reverted;
    await doomsday.connect(signer3).withdrawFrom(1, signer1.address, target);
    await expect(
      doomsday.connect(signer3).withdrawFrom(1, signer1.address, target),
    ).to.be.reverted;
    const destBalance = await signer1.provider.getBalance(target);
    assert.equal(destBalance, finalWeiPerToken);
  });
});
