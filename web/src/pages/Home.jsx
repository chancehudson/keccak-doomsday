import React from "react";
import { observer } from "mobx-react-lite";
import state from "../state/state";

export default observer(() => {
  const { contract } = React.useContext(state);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "vertical",
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ maxWidth: "500px" }}>
        <h2>Keccak Doomsday</h2>
        <p>Put a bounty on progressively breaking the Keccak hash function!</p>
        <h4>Why?</h4>
        <p>
          Ethereum relies on the Keccak256 hash function for a lot of things.
          It's probably a good idea to incentivize a public tracker for how much
          of the function has been broken.
        </p>
        <h4>Does this actually break Keccak?</h4>
        <p>
          Well, no. This device simply tracks how quickly computation power is
          increasing and how large of a space we can search.
        </p>
        <h4>How does the bounty work?</h4>
        <p>
          Anyone can send Ether to the contract and receive KDD tokens in
          return. As the hash function is broken the Ether is paid out to those
          that prove they broke it. After 10 years the contract halts and any
          remaining Ether is returned to the token holders.
        </p>
      </div>
      <div style={{ maxWidth: "500px" }}>
        <h2>Contract Info</h2>
        <p>
          Current balance: <strong>{contract.balance.toString()} wei</strong>
        </p>
        <p>
          Halted: <strong>{contract.halted.toString()}</strong>
        </p>
        {contract.nextTarget ? (
          <>
            <p>Next target: </p>
            <div style={{ display: "flex" }}>
              <span style={{ width: "12px" }} />
              <span>
                Bits: <strong>{contract.nextTarget[1].toString()}</strong>
              </span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ width: "12px" }} />
              <span>
                Target hash (lower bytes only):{" "}
                <strong>{contract.nextTarget[0].toString().slice(-20)}</strong>
              </span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ width: "12px" }} />
              <span>
                Expected reward:{" "}
                <strong>{contract.expectedReward.toString()} wei</strong>
              </span>
            </div>
            <p>
              Instructions: find a keccak256 input that generates the same{" "}
              {contract.nextTarget[1].toString()} lower bits as above. See{" "}
              <a
                target="_blank"
                href="https://github.com/chancehudson/keccak-doomsday/blob/13971aa64727351f772d17087ac930836ea4180b/contracts/test/doomsday.js#L7"
              >
                here
              </a>{" "}
              for a naïve example implementation.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
});
