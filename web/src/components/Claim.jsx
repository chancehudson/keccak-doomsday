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
  const [waitingToFinish, setWaitingToFinish] = React.useState(false);
  return (
    <div>
      <h2>Claim</h2>
      <p>
        Claiming a reward happens in 2 phases. First you secretly commit to the
        value that collides with the target. Second, you reveal the value and
        claim your reward. This 2 phase approach is to avoid others frontrunning
        your transaction.
      </p>
      <p>
        Use the begin claim button first, then wait at least 2 minutes after
        transaction confirmation to use finish claim. A claim is valid for 24
        hours after it begins.
      </p>
      <p>
        DEV NOTE: for testing you can use finish claim immediately after begin
        claim transaction is confirmed.
      </p>
      <p>
        WARNING: finding a collision in browser may cause the browser to freeze.
      </p>
      <input
        placeholder="hash pre-image hex"
        type="text"
        value={preImage}
        size={66}
        style={{ fontSize: "11px", marginBottom: "4px" }}
        onChange={(e) => {
          setPreImage(e.target.value);
        }}
      />
      <div></div>
      <button
        onClick={async () => {
          try {
            await contract.beginClaim(preImage);
          } catch (err) {
            console.log("transaction error", err);
          }
        }}
      >
        begin claim
      </button>
      <button
        onClick={async () => {
          try {
            await contract.finishClaim(preImage);
          } catch (err) {
            console.log("transaction error", err);
          }
        }}
      >
        finish claim
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
