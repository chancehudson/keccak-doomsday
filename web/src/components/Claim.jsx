import React from "react";
import { observer } from "mobx-react-lite";
import { ethers } from "ethers";
import state from "../state/state";
import convert from "ethereum-unit-converter";

const findCollision = (target, bits, startAt = 0) => {
  const target_bits = BigInt(target)
    .toString(2)
    .split("")
    .reverse()
    .slice(0, Number(bits))
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
      .slice(0, Number(bits))
      .join("");
    if (out_bits === target_bits) {
      return i;
    }
  }
};

export default observer(() => {
  const { contract } = React.useContext(state);
  const [preImage, setPreImage] = React.useState("");
  return (
    <div>
      <h2>Claim</h2>
      <p>
        Claiming a reward happens in 2 phases. First you secretly commit to the
        value that collides with the target. Second, you reveal the value and
        claim your reward. This 2 phase approach is to avoid others frontrunning
        your transaction.
      </p>
      <input
        placeholder="hash pre-image hex"
        type="text"
        value={preImage}
        onChange={(e) => {
          setPreImage(e.target.value);
        }}
      />
      <div></div>
      <button
        onClick={async () => {
          try {
            await contract.beginOrFinishClaim(preImage);
          } catch (err) {
            console.log("transaction error", err);
          }
        }}
      >
        claim
      </button>
      <button
        onClick={() => {
          const [hash, bits] = contract.nextTarget;
          const collision = findCollision(hash, bits + 1n);
          setPreImage(collision);
        }}
      >
        find collision
      </button>
    </div>
  );
});
